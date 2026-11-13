import {
  CONTACT_CATEGORIES,
  DEFAULT_FILTERS,
  type Contact,
  type ContactCategory,
  type ContactDraft,
  type ContactFilters,
  type SortOption,
} from '../domain/contact';
import {
  applyJsonImport,
  exportContactsToCsv,
  exportContactsToJson,
  type ImportPreview,
  type ImportStrategy,
} from '../domain/importExport';
import {
  computeContactStats,
  queryContacts,
} from '../domain/searchFilterSort';
import { validateContactDraft } from '../domain/validation';
import { ContactRepository } from '../storage/contactRepository';
import { animateContactItems, animateEntrance } from './animations';
import { openConfirmDialog } from './confirmDialog';
import { openContactFormModal } from './contactFormModal';
import { renderContactList } from './contactList';
import { clearChildren, el } from './dom';
import { createIcon } from './icons';
import { openImportModal } from './importModal';
import { createToastManager } from './toast';

function generateContactId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok: boolean;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  textarea.remove();
  return ok;
}

export function mountAgendaApp(
  root: HTMLElement,
  repository: ContactRepository = new ContactRepository(),
): void {
  clearChildren(root);

  let contacts: Contact[] = [];
  let filters: ContactFilters = { ...DEFAULT_FILTERS };
  let corruptedRawBackup: string | null = null;
  let storageWarning: string | null = null;

  const initialLoad = repository.load();
  contacts = initialLoad.contacts;

  if (initialLoad.status === 'corrupted') {
    corruptedRawBackup = initialLoad.rawBackup ?? null;
    storageWarning =
      initialLoad.error ??
      'Os dados salvos localmente estavam corrompidos e foram isolados em backup.';
  } else if (initialLoad.status === 'unavailable') {
    storageWarning =
      initialLoad.error ??
      'O armazenamento local não está disponível; alterações ficarão apenas nesta sessão.';
  }

  // Toast & live region
  const liveRegion = el('div', {
    className: 'sr-only',
    attrs: { 'aria-live': 'polite', 'aria-atomic': 'true', id: 'a11y-announcer' },
  });
  const toastContainer = el('div', {
    className: 'toast-stack',
  });
  const toast = createToastManager(toastContainer, liveRegion);

  // Header
  const header = el('header', {
    className: 'topbar',
    children: [
      el('div', {
        className: 'topbar__inner container',
        children: [
          el('div', {
            className: 'brand',
            children: [
              el('span', { className: 'brand__mark', text: 'rl.', attrs: { 'aria-hidden': 'true' } }),
              el('div', {
                className: 'brand__text',
                children: [
                  el('span', { className: 'brand__name', text: 'RYAN LEAL' }),
                  el('span', { className: 'brand__edition', text: 'RL-002 / CONNECTED UNIVERSE' }),
                ],
              }),
            ],
          }),
          el('div', {
            className: 'topbar__actions',
            children: [
              el('span', {
                className: 'privacy-badge',
                attrs: {
                  title: 'Dados persistidos localmente no navegador, sem envio para servidores.',
                },
                children: [
                  el('span', { className: 'privacy-badge__dot', attrs: { 'aria-hidden': 'true' } }),
                  el('span', { text: 'Armazenamento local' }),
                ],
              }),
              el('a', {
                className: 'portfolio-link',
                attrs: {
                  href: 'https://ryanleal.com.br/',
                  target: '_blank',
                  rel: 'noopener noreferrer',
                },
                children: [
                  el('span', { text: 'ryanleal.com.br' }),
                  el('span', {
                    className: 'sr-only',
                    text: ' (portfólio de Ryan Leal, abre em nova aba)',
                  }),
                  createIcon('arrow-up-right', 15),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Hero / Command strip
  const addContactBtn = el('button', {
    className: 'btn btn--primary btn--lg',
    attrs: { type: 'button', 'data-testid': 'add-contact-btn' },
    children: [createIcon('plus', 18), el('span', { text: 'Novo contato' })],
    on: { click: () => handleOpenCreate() },
  });

  const importBtn = el('button', {
    className: 'btn btn--ghost',
    attrs: { type: 'button', 'data-testid': 'import-btn' },
    children: [createIcon('upload', 16), el('span', { text: 'Importar' })],
    on: { click: () => handleOpenImport() },
  });

  const exportJsonBtn = el('button', {
    className: 'btn btn--ghost',
    attrs: { type: 'button', 'data-testid': 'export-json-btn' },
    children: [createIcon('download', 16), el('span', { text: 'JSON' })],
    on: { click: () => handleExportJson() },
  });

  const exportCsvBtn = el('button', {
    className: 'btn btn--ghost',
    attrs: { type: 'button', 'data-testid': 'export-csv-btn' },
    children: [createIcon('download', 16), el('span', { text: 'CSV' })],
    on: { click: () => handleExportCsv() },
  });

  const statTotalVal = el('strong', { className: 'stat-card__value', text: '0', attrs: { 'data-testid': 'stat-total' } });
  const statFavVal = el('strong', { className: 'stat-card__value', text: '0', attrs: { 'data-testid': 'stat-favorites' } });
  const statCatVal = el('strong', { className: 'stat-card__value', text: '0', attrs: { 'data-testid': 'stat-categories' } });
  const statVisibleVal = el('strong', { className: 'stat-card__value', text: '0', attrs: { 'data-testid': 'stat-visible' } });

  const heroSection = el('section', {
    className: 'hero container',
    attrs: { 'aria-labelledby': 'page-title' },
    children: [
      el('div', {
        className: 'hero__top',
        children: [
          el('div', {
            className: 'hero__copy',
            children: [
              el('p', {
                className: 'hero__kicker',
                children: [
                  el('span', { className: 'hero__dot', attrs: { 'aria-hidden': 'true' } }),
                  el('span', { text: 'REDE DE CONTATOS · DADOS LOCAIS E SEGUROS' }),
                ],
              }),
              el('h1', {
                id: 'page-title',
                className: 'hero__title',
                children: [
                  el('span', { text: 'AGENDA DE ' }),
                  el('span', { className: 'hero__title-outline', text: 'CONTATOS' }),
                  el('span', { className: 'hero__title-accent', text: '.' }),
                ],
              }),
              el('p', {
                className: 'hero__subtitle',
                text: 'Organize conexões pessoais e profissionais com busca instantânea, validação rigorosa e exportação portátil.',
              }),
            ],
          }),
          el('div', {
            className: 'hero__cta-group',
            children: [
              addContactBtn,
              el('div', {
                className: 'hero__io-group',
                attrs: { role: 'group', 'aria-label': 'Importar e exportar contatos' },
                children: [importBtn, exportJsonBtn, exportCsvBtn],
              }),
            ],
          }),
        ],
      }),
      el('div', {
        className: 'stats-grid',
        attrs: { 'aria-label': 'Indicadores da agenda' },
        children: [
          el('div', {
            className: 'stat-card',
            children: [
              el('span', { className: 'stat-card__label', text: 'Total de contatos' }),
              statTotalVal,
            ],
          }),
          el('div', {
            className: 'stat-card',
            children: [
              el('span', { className: 'stat-card__label', text: 'Favoritos' }),
              statFavVal,
            ],
          }),
          el('div', {
            className: 'stat-card',
            children: [
              el('span', { className: 'stat-card__label', text: 'Categorias ativas' }),
              statCatVal,
            ],
          }),
          el('div', {
            className: 'stat-card stat-card--accent',
            children: [
              el('span', { className: 'stat-card__label', text: 'Exibindo agora' }),
              statVisibleVal,
            ],
          }),
        ],
      }),
    ],
  });

  // Alert banner for storage warnings / corrupted backup recovery
  const recoveryBanner = el('div', {
    className: 'container',
    attrs: { 'data-testid': 'recovery-banner-host' },
  });

  function renderRecoveryBanner(): void {
    clearChildren(recoveryBanner);
    if (!storageWarning && !corruptedRawBackup) return;

    const bannerActions: HTMLElement[] = [];
    if (corruptedRawBackup) {
      const rawSnapshot = corruptedRawBackup;
      bannerActions.push(
        el('button', {
          className: 'btn btn--ghost btn--sm',
          text: 'Baixar backup bruto',
          attrs: { type: 'button', 'data-testid': 'download-corrupted-backup' },
          on: {
            click: () => {
              triggerFileDownload(
                `agenda-backup-recuperacao-${new Date().toISOString().slice(0, 10)}.json`,
                rawSnapshot,
                'application/json;charset=utf-8',
              );
              toast.show('Backup bruto baixado.', 'info');
            },
          },
        }),
        el('button', {
          className: 'btn btn--ghost btn--sm',
          text: 'Descartar aviso',
          attrs: { type: 'button' },
          on: {
            click: () => {
              corruptedRawBackup = null;
              storageWarning = null;
              repository.clearCorruptedBackup();
              renderRecoveryBanner();
            },
          },
        }),
      );
    }

    recoveryBanner.appendChild(
      el('div', {
        className: 'alert-banner',
        attrs: { role: 'alert', 'data-testid': 'storage-warning-banner' },
        children: [
          el('div', {
            className: 'alert-banner__content',
            children: [
              createIcon('alert', 18),
              el('span', {
                text:
                  storageWarning ??
                  'Aviso de armazenamento local.',
              }),
            ],
          }),
          bannerActions.length > 0
            ? el('div', { className: 'alert-banner__actions', children: bannerActions })
            : null,
        ],
      }),
    );
  }

  // Toolbar: search, favorites, category, sort
  const searchInput = el('input', {
    id: 'search-contacts',
    className: 'search-box__input',
    attrs: {
      type: 'search',
      placeholder: 'Buscar por nome, telefone ou e-mail...',
      'aria-label': 'Buscar contatos por nome, telefone ou e-mail',
      'data-testid': 'search-input',
    },
  });

  const favFilterBtn = el('button', {
    className: 'filter-chip',
    attrs: {
      type: 'button',
      'aria-pressed': 'false',
      'data-testid': 'filter-favorites',
    },
    children: [createIcon('star', 15), el('span', { text: 'Favoritos' })],
  });

  const categoryFilterSelect = el('select', {
    id: 'filter-category',
    className: 'toolbar-select',
    attrs: {
      'aria-label': 'Filtrar por categoria',
      'data-testid': 'filter-category',
    },
    children: [
      el('option', { text: 'Todas categorias', attrs: { value: 'todas' } }),
      ...CONTACT_CATEGORIES.map((c) =>
        el('option', { text: c.label, attrs: { value: c.value } }),
      ),
    ],
  });

  const sortSelect = el('select', {
    id: 'sort-contacts',
    className: 'toolbar-select',
    attrs: {
      'aria-label': 'Ordenar contatos',
      'data-testid': 'sort-select',
    },
    children: [
      el('option', { text: 'Nome (A–Z)', attrs: { value: 'nome-asc' } }),
      el('option', { text: 'Nome (Z–A)', attrs: { value: 'nome-desc' } }),
      el('option', { text: 'Mais recentes', attrs: { value: 'criado-desc' } }),
      el('option', { text: 'Atualizados recentemente', attrs: { value: 'atualizado-desc' } }),
    ],
  });

  const clearFiltersBtn = el('button', {
    className: 'btn btn--ghost btn--sm',
    text: 'Limpar filtros',
    attrs: { type: 'button', hidden: true, 'data-testid': 'toolbar-clear-filters' },
    on: { click: () => resetFilters() },
  });

  const toolbarSection = el('section', {
    className: 'toolbar container',
    attrs: { 'aria-label': 'Busca e filtros de contatos' },
    children: [
      el('div', {
        className: 'search-box',
        children: [
          el('span', { className: 'search-box__icon', children: [createIcon('search', 17)] }),
          searchInput,
        ],
      }),
      el('div', {
        className: 'toolbar__controls',
        children: [
          favFilterBtn,
          el('div', {
            className: 'select-wrap',
            children: [categoryFilterSelect],
          }),
          el('div', {
            className: 'select-wrap',
            children: [sortSelect],
          }),
          clearFiltersBtn,
        ],
      }),
    ],
  });

  const listHost = el('div', { className: 'container list-host' });
  const main = el('main', {
    id: 'main-content',
    className: 'app-main',
    children: [heroSection, recoveryBanner, toolbarSection, listHost],
  });

  const footer = el('footer', {
    className: 'app-footer',
    children: [
      el('div', {
        className: 'container app-footer__inner',
        children: [
          el('p', {
            className: 'app-footer__privacy',
            children: [
              createIcon('shield', 15),
              el('span', {
                text: 'Privacidade local: seus contatos ficam salvos apenas neste navegador e dispositivo, sem sincronização automática ou envio a servidores.',
              }),
            ],
          }),
          el('div', {
            className: 'app-footer__links',
            children: [
              el('a', {
                className: 'app-footer__link',
                attrs: {
                  href: 'https://ryanleal.com.br/',
                  target: '_blank',
                  rel: 'noopener noreferrer',
                },
                children: [el('span', { text: 'Portfólio Ryan Leal' }), createIcon('arrow-up-right', 14)],
              }),
              el('a', {
                className: 'app-footer__link',
                attrs: {
                  href: 'https://github.com/washryan/projeto_agenda_contatos',
                  target: '_blank',
                  rel: 'noopener noreferrer',
                },
                children: [el('span', { text: 'Repositório GitHub' }), createIcon('arrow-up-right', 14)],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const skipLink = el('a', {
    className: 'skip-link',
    text: 'Ir para o conteúdo principal',
    attrs: { href: '#main-content' },
  });

  root.append(skipLink, header, main, footer, toastContainer, liveRegion);

  function persistContacts(nextContacts: Contact[]): boolean {
    contacts = nextContacts;
    const saveResult = repository.save(contacts);
    if (!saveResult.ok) {
      storageWarning = saveResult.error ?? 'Falha ao salvar localmente.';
      renderRecoveryBanner();
      toast.show(storageWarning, 'error');
      return false;
    }
    return true;
  }

  function resetFilters(): void {
    filters = { ...DEFAULT_FILTERS };
    searchInput.value = '';
    categoryFilterSelect.value = 'todas';
    sortSelect.value = 'nome-asc';
    favFilterBtn.setAttribute('aria-pressed', 'false');
    favFilterBtn.classList.remove('filter-chip--active');
    render();
  }

  function handleOpenCreate(): void {
    openContactFormModal({
      mode: 'create',
      existingContacts: contacts,
      onSave: (draft: ContactDraft) => {
        const validation = validateContactDraft(draft, contacts);
        if (!validation.ok || !validation.sanitizedDraft) return;
        const now = new Date().toISOString();
        const newContact: Contact = {
          id: generateContactId(),
          ...validation.sanitizedDraft,
          criadoEm: now,
          atualizadoEm: now,
        };
        persistContacts([newContact, ...contacts]);
        render(true);
        toast.show(`Contato "${newContact.nome}" adicionado.`, 'success');
      },
    });
  }

  function handleOpenEdit(contact: Contact): void {
    openContactFormModal({
      mode: 'edit',
      contact,
      existingContacts: contacts,
      onSave: (draft: ContactDraft, editingId?: string) => {
        if (!editingId) return;
        const validation = validateContactDraft(draft, contacts, editingId);
        if (!validation.ok || !validation.sanitizedDraft) return;
        const now = new Date().toISOString();
        const sanitized = validation.sanitizedDraft;
        const updated = contacts.map((item): Contact => {
          if (item.id !== editingId) return item;
          return {
            id: item.id,
            nome: sanitized.nome,
            telefone: sanitized.telefone,
            telefoneNormalizado: sanitized.telefoneNormalizado,
            ...(sanitized.email ? { email: sanitized.email } : {}),
            ...(sanitized.categoria ? { categoria: sanitized.categoria } : {}),
            ...(sanitized.observacoes ? { observacoes: sanitized.observacoes } : {}),
            favorito: sanitized.favorito,
            criadoEm: item.criadoEm,
            atualizadoEm: now,
          };
        });
        persistContacts(updated);
        render();
        toast.show(`Contato "${sanitized.nome}" atualizado.`, 'success');
      },
    });
  }

  async function handleDelete(contact: Contact): Promise<void> {
    const confirmed = await openConfirmDialog({
      title: 'Excluir contato?',
      description: `Tem certeza que deseja remover "${contact.nome}" (${contact.telefone}) da sua agenda? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir contato',
      cancelLabel: 'Cancelar',
      danger: true,
    });

    if (!confirmed) {
      toast.show('Exclusão cancelada.', 'info');
      return;
    }

    const remaining = contacts.filter((c) => c.id !== contact.id);
    persistContacts(remaining);
    render();
    toast.show(`Contato "${contact.nome}" excluído.`, 'success');
  }

  function handleToggleFavorite(id: string): void {
    const target = contacts.find((c) => c.id === id);
    if (!target) return;
    const nextFav = !target.favorito;
    const now = new Date().toISOString();
    const updated = contacts.map((c) =>
      c.id === id ? { ...c, favorito: nextFav, atualizadoEm: now } : c,
    );
    persistContacts(updated);
    render();
    toast.show(
      nextFav
        ? `"${target.nome}" adicionado aos favoritos.`
        : `"${target.nome}" removido dos favoritos.`,
      'info',
    );
  }

  async function handleCopyPhone(contact: Contact): Promise<void> {
    const copied = await copyTextToClipboard(contact.telefone);
    if (copied) {
      toast.show(`Telefone ${contact.telefone} copiado.`, 'success');
    } else {
      toast.show('Não foi possível copiar o telefone automaticamente.', 'error');
    }
  }

  function handleExportJson(): void {
    if (contacts.length === 0) {
      toast.show('Adicione ao menos um contato antes de exportar.', 'info');
      return;
    }
    const content = exportContactsToJson(contacts);
    triggerFileDownload(
      `agenda-contatos-${new Date().toISOString().slice(0, 10)}.json`,
      content,
      'application/json;charset=utf-8',
    );
    toast.show(`${contacts.length} contato(s) exportado(s) em JSON.`, 'success');
  }

  function handleExportCsv(): void {
    if (contacts.length === 0) {
      toast.show('Adicione ao menos um contato antes de exportar.', 'info');
      return;
    }
    const content = exportContactsToCsv(contacts);
    triggerFileDownload(
      `agenda-contatos-${new Date().toISOString().slice(0, 10)}.csv`,
      content,
      'text/csv;charset=utf-8',
    );
    toast.show(`${contacts.length} contato(s) exportado(s) em CSV.`, 'success');
  }

  function handleOpenImport(): void {
    openImportModal({
      existingContacts: contacts,
      onImport: (preview: ImportPreview, strategy: ImportStrategy) => {
        const applied = applyJsonImport(contacts, preview.validContacts, strategy);
        persistContacts(applied.contacts);
        render(true);

        if (applied.replacedTotal) {
          toast.show(
            `Agenda substituída com ${applied.addedCount} contato(s) importado(s).`,
            'success',
          );
        } else {
          const skipText =
            applied.skippedDuplicatesCount > 0
              ? ` (${applied.skippedDuplicatesCount} duplicado(s) ignorado(s))`
              : '';
          toast.show(
            `${applied.addedCount} contato(s) importado(s)${skipText}.`,
            'success',
          );
        }
      },
    });
  }

  function render(animateList = false): void {
    const visible = queryContacts(contacts, filters);
    const stats = computeContactStats(contacts, visible);

    statTotalVal.textContent = String(stats.total);
    statFavVal.textContent = String(stats.favoritos);
    statCatVal.textContent = String(stats.categoriasAtivas);
    statVisibleVal.textContent = String(stats.visiveis);

    const hasActiveFilters =
      filters.busca.trim() !== '' ||
      filters.somenteFavoritos ||
      filters.categoria !== 'todas';
    clearFiltersBtn.hidden = !hasActiveFilters;

    exportJsonBtn.disabled = contacts.length === 0;
    exportCsvBtn.disabled = contacts.length === 0;

    renderRecoveryBanner();
    const cards = renderContactList(listHost, visible, contacts.length, {
      onToggleFavorite: handleToggleFavorite,
      onEdit: handleOpenEdit,
      onDelete: handleDelete,
      onCopyPhone: handleCopyPhone,
      onAddFirst: handleOpenCreate,
      onOpenImport: handleOpenImport,
      onClearFilters: resetFilters,
    });

    if (animateList && cards.length > 0) {
      animateContactItems(cards);
    }
  }

  // Event listeners for search/filter/sort
  searchInput.addEventListener('input', () => {
    filters = { ...filters, busca: searchInput.value };
    render();
  });

  favFilterBtn.addEventListener('click', () => {
    const next = !filters.somenteFavoritos;
    filters = { ...filters, somenteFavoritos: next };
    favFilterBtn.setAttribute('aria-pressed', String(next));
    favFilterBtn.classList.toggle('filter-chip--active', next);
    render();
  });

  categoryFilterSelect.addEventListener('change', () => {
    filters = {
      ...filters,
      categoria: categoryFilterSelect.value as ContactCategory | 'todas',
    };
    render();
  });

  sortSelect.addEventListener('change', () => {
    filters = { ...filters, ordenacao: sortSelect.value as SortOption };
    render();
  });

  render();
  animateEntrance([heroSection, toolbarSection, listHost]);

  if (initialLoad.status === 'migrated') {
    toast.show('Agenda migrada para o novo formato v1 com segurança.', 'info');
  }
}
