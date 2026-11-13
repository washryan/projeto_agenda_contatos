import { CONTACT_CATEGORIES, type Contact } from '../domain/contact';
import { normalizePhone } from '../domain/normalize';
import { clearChildren, el } from './dom';
import { createIcon } from './icons';

export interface ContactListActions {
  readonly onToggleFavorite: (id: string) => void;
  readonly onEdit: (contact: Contact) => void;
  readonly onDelete: (contact: Contact) => void;
  readonly onCopyPhone: (contact: Contact) => void;
  readonly onAddFirst: () => void;
  readonly onOpenImport: () => void;
  readonly onClearFilters: () => void;
}

const CATEGORY_LABELS = new Map(CONTACT_CATEGORIES.map((c) => [c.value, c.label]));

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return `${first}${last}`.toUpperCase();
}

function formatShortDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function renderContactList(
  container: HTMLElement,
  visibleContacts: readonly Contact[],
  totalCount: number,
  actions: ContactListActions,
): HTMLElement[] {
  clearChildren(container);

  if (totalCount === 0) {
    const emptyState = el('section', {
      className: 'empty-state',
      attrs: { 'data-testid': 'empty-state-initial', 'aria-label': 'Agenda vazia' },
      children: [
        el('div', {
          className: 'empty-state__emblem',
          attrs: { 'aria-hidden': 'true' },
          children: [createIcon('users', 28)],
        }),
        el('p', {
          className: 'empty-state__kicker',
          text: 'RL-002 // REDE INICIALIZADA',
        }),
        el('h2', {
          className: 'empty-state__title',
          text: 'NENHUMA CONEXÃO REGISTRADA AINDA',
        }),
        el('p', {
          className: 'empty-state__text',
          text: 'Adicione seu primeiro contato ou importe um arquivo JSON. Tudo permanece salvo localmente apenas neste navegador.',
        }),
        el('div', {
          className: 'empty-state__actions',
          children: [
            el('button', {
              className: 'btn btn--primary',
              attrs: { type: 'button', 'data-testid': 'empty-add-btn' },
              children: [createIcon('plus', 16), el('span', { text: 'Adicionar primeiro contato' })],
              on: { click: actions.onAddFirst },
            }),
            el('button', {
              className: 'btn btn--ghost',
              attrs: { type: 'button', 'data-testid': 'empty-import-btn' },
              children: [createIcon('upload', 16), el('span', { text: 'Importar JSON' })],
              on: { click: actions.onOpenImport },
            }),
          ],
        }),
      ],
    });
    container.appendChild(emptyState);
    return [];
  }

  if (visibleContacts.length === 0) {
    const noResults = el('section', {
      className: 'empty-state empty-state--compact',
      attrs: { 'data-testid': 'empty-state-filtered', 'aria-label': 'Nenhum resultado' },
      children: [
        el('div', {
          className: 'empty-state__emblem',
          attrs: { 'aria-hidden': 'true' },
          children: [createIcon('search', 26)],
        }),
        el('h2', {
          className: 'empty-state__title',
          text: 'NENHUM CONTATO ENCONTRADO',
        }),
        el('p', {
          className: 'empty-state__text',
          text: 'Nenhum registro corresponde aos termos de busca ou filtros aplicados no momento.',
        }),
        el('div', {
          className: 'empty-state__actions',
          children: [
            el('button', {
              className: 'btn btn--ghost',
              attrs: { type: 'button', 'data-testid': 'clear-filters-empty-btn' },
              children: [
                createIcon('filter-clear', 16),
                el('span', { text: 'Limpar busca e filtros' }),
              ],
              on: { click: actions.onClearFilters },
            }),
          ],
        }),
      ],
    });
    container.appendChild(noResults);
    return [];
  }

  const list = el('ul', {
    className: 'contact-list',
    attrs: { 'data-testid': 'contact-list', 'aria-label': 'Contatos cadastrados' },
  });

  const cardElements: HTMLElement[] = [];

  for (const contact of visibleContacts) {
    const phoneMeta = normalizePhone(contact.telefoneNormalizado || contact.telefone);
    const telHref = phoneMeta.telHref ?? `tel:${contact.telefoneNormalizado}`;
    const whatsappHref = phoneMeta.whatsappHref;
    const categoryLabel = contact.categoria
      ? CATEGORY_LABELS.get(contact.categoria) ?? contact.categoria
      : null;

    const actionLinks: HTMLElement[] = [
      el('a', {
        className: 'icon-btn icon-btn--phone',
        attrs: {
          href: telHref,
          'aria-label': `Ligar para ${contact.nome}`,
          title: `Ligar (${contact.telefone})`,
          'data-testid': 'action-call',
        },
        children: [createIcon('phone', 16)],
      }),
    ];

    if (whatsappHref) {
      actionLinks.push(
        el('a', {
          className: 'icon-btn icon-btn--whatsapp',
          attrs: {
            href: whatsappHref,
            target: '_blank',
            rel: 'noopener noreferrer',
            'aria-label': `Abrir WhatsApp de ${contact.nome}`,
            title: 'Conversar no WhatsApp',
            'data-testid': 'action-whatsapp',
          },
          children: [createIcon('message', 16)],
        }),
      );
    }

    actionLinks.push(
      el('button', {
        className: 'icon-btn',
        attrs: {
          type: 'button',
          'aria-label': `Copiar telefone de ${contact.nome}`,
          title: 'Copiar telefone',
          'data-testid': 'action-copy',
        },
        children: [createIcon('copy', 16)],
        on: { click: () => actions.onCopyPhone(contact) },
      }),
      el('button', {
        className: 'icon-btn',
        attrs: {
          type: 'button',
          'aria-label': `Editar ${contact.nome}`,
          title: 'Editar contato',
          'data-testid': 'action-edit',
        },
        children: [createIcon('edit', 16)],
        on: { click: () => actions.onEdit(contact) },
      }),
      el('button', {
        className: 'icon-btn icon-btn--danger',
        attrs: {
          type: 'button',
          'aria-label': `Excluir ${contact.nome}`,
          title: 'Excluir contato',
          'data-testid': 'action-delete',
        },
        children: [createIcon('trash', 16)],
        on: { click: () => actions.onDelete(contact) },
      }),
    );

    const metaItems: HTMLElement[] = [];
    if (contact.email) {
      metaItems.push(
        el('span', {
          className: 'contact-card__meta-item',
          text: contact.email,
          attrs: { 'data-testid': 'contact-email' },
        }),
      );
    }
    if (contact.observacoes) {
      metaItems.push(
        el('span', {
          className: 'contact-card__notes',
          text: contact.observacoes,
          attrs: { 'data-testid': 'contact-notes' },
        }),
      );
    }

    const updatedText = formatShortDate(contact.atualizadoEm);

    const card = el('li', {
      className: contact.favorito ? 'contact-card contact-card--favorite' : 'contact-card',
      attrs: {
        'data-testid': 'contact-item',
        'data-contact-id': contact.id,
      },
      children: [
        el('div', {
          className: 'contact-card__identity',
          children: [
            el('div', {
              className: 'contact-card__avatar',
              text: getInitials(contact.nome),
              attrs: { 'aria-hidden': 'true' },
            }),
            el('div', {
              className: 'contact-card__primary',
              children: [
                el('div', {
                  className: 'contact-card__name-row',
                  children: [
                    el('h3', {
                      className: 'contact-card__name',
                      text: contact.nome,
                      attrs: { 'data-testid': 'contact-name' },
                    }),
                    categoryLabel
                      ? el('span', {
                          className: `category-pill category-pill--${contact.categoria}`,
                          text: categoryLabel,
                          attrs: { 'data-testid': 'contact-category' },
                        })
                      : null,
                  ],
                }),
                el('p', {
                  className: 'contact-card__phone',
                  text: contact.telefone,
                  attrs: { 'data-testid': 'contact-phone' },
                }),
                metaItems.length > 0
                  ? el('div', {
                      className: 'contact-card__details',
                      children: metaItems,
                    })
                  : null,
              ],
            }),
          ],
        }),
        el('div', {
          className: 'contact-card__controls',
          children: [
            updatedText
              ? el('span', {
                  className: 'contact-card__timestamp',
                  text: `Atualizado em ${updatedText}`,
                })
              : null,
            el('div', {
              className: 'contact-card__actions',
              children: [
                el('button', {
                  className: contact.favorito
                    ? 'icon-btn icon-btn--star-active'
                    : 'icon-btn icon-btn--star',
                  attrs: {
                    type: 'button',
                    'aria-pressed': String(contact.favorito),
                    'aria-label': contact.favorito
                      ? `Remover ${contact.nome} dos favoritos`
                      : `Favoritar ${contact.nome}`,
                    title: contact.favorito ? 'Remover dos favoritos' : 'Marcar como favorito',
                    'data-testid': 'action-favorite',
                  },
                  children: [createIcon(contact.favorito ? 'star-filled' : 'star', 16)],
                  on: { click: () => actions.onToggleFavorite(contact.id) },
                }),
                ...actionLinks,
              ],
            }),
          ],
        }),
      ],
    });

    list.appendChild(card);
    cardElements.push(card);
  }

  container.appendChild(list);
  return cardElements;
}
