import type { Contact } from '../domain/contact';
import {
  previewJsonImport,
  type ImportPreview,
  type ImportStrategy,
} from '../domain/importExport';
import { animateModalOpen } from './animations';
import { openConfirmDialog } from './confirmDialog';
import { el } from './dom';
import { createIcon } from './icons';

export interface ImportModalOptions {
  readonly existingContacts: readonly Contact[];
  readonly onImport: (preview: ImportPreview, strategy: ImportStrategy) => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openImportModal(options: ImportModalOptions): void {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const titleId = 'import-modal-title';
  const descId = 'import-modal-desc';

  let currentPreview: ImportPreview | null = null;

  const fileInput = el('input', {
    id: 'import-file-input',
    className: 'import-drop__input',
    attrs: {
      type: 'file',
      accept: '.json,application/json',
      'data-testid': 'import-file-input',
    },
  });

  const statusBox = el('div', {
    className: 'import-status',
    attrs: { 'aria-live': 'polite', 'data-testid': 'import-status' },
  });

  const mergeRadio = el('input', {
    id: 'strategy-merge',
    attrs: {
      type: 'radio',
      name: 'import-strategy',
      value: 'merge-skip',
      checked: true,
    },
  });

  const replaceRadio = el('input', {
    id: 'strategy-replace',
    attrs: {
      type: 'radio',
      name: 'import-strategy',
      value: 'replace',
    },
  });

  const confirmBtn = el('button', {
    className: 'btn btn--primary',
    text: 'Importar contatos',
    attrs: {
      type: 'button',
      disabled: true,
      'data-testid': 'import-confirm',
    },
  });

  function renderPreview(preview: ImportPreview): void {
    currentPreview = preview;
    statusBox.replaceChildren();

    if (!preview.ok) {
      statusBox.className = 'import-status import-status--error';
      statusBox.appendChild(
        el('p', {
          text: preview.error ?? 'Falha ao validar o arquivo JSON.',
        }),
      );
      confirmBtn.disabled = true;
      return;
    }

    statusBox.className = 'import-status import-status--ready';
    const parts = [
      `${preview.validContacts.length} contato(s) válido(s) encontrado(s)`,
      `${preview.newContactsCount} novo(s)`,
    ];
    if (preview.duplicateInExistingCount > 0) {
      parts.push(`${preview.duplicateInExistingCount} já existente(s)`);
    }
    if (preview.skippedInvalidCount > 0) {
      parts.push(`${preview.skippedInvalidCount} registro(s) inválido(s) descartado(s)`);
    }

    statusBox.appendChild(el('p', { text: `${parts.join(' · ')}.` }));
    confirmBtn.disabled = false;
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      renderPreview({
        ok: false,
        validContacts: [],
        skippedInvalidCount: 0,
        duplicateInExistingCount: 0,
        newContactsCount: 0,
        error: 'O arquivo excede o limite de 2 MB.',
      });
      return;
    }

    try {
      const text = await file.text();
      const preview = previewJsonImport(text, options.existingContacts);
      renderPreview(preview);
    } catch {
      renderPreview({
        ok: false,
        validContacts: [],
        skippedInvalidCount: 0,
        duplicateInExistingCount: 0,
        newContactsCount: 0,
        error: 'Não foi possível ler o arquivo selecionado.',
      });
    }
  });

  function closeModal(): void {
    document.removeEventListener('keydown', handleKeyDown, true);
    backdrop.remove();
    previouslyFocused?.focus();
  }

  confirmBtn.addEventListener('click', async () => {
    if (!currentPreview || !currentPreview.ok) return;

    const strategy: ImportStrategy = replaceRadio.checked ? 'replace' : 'merge-skip';

    if (strategy === 'replace' && options.existingContacts.length > 0) {
      const confirmed = await openConfirmDialog({
        title: 'Substituir agenda atual?',
        description: `Esta ação substituirá todos os ${options.existingContacts.length} contato(s) atuais pelos ${currentPreview.validContacts.length} contato(s) do arquivo importado.`,
        confirmLabel: 'Sim, substituir tudo',
        cancelLabel: 'Voltar',
        danger: true,
      });
      if (!confirmed) return;
    }

    const previewToApply = currentPreview;
    closeModal();
    options.onImport(previewToApply, strategy);
  });

  const panel = el('div', {
    className: 'modal',
    attrs: {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      'aria-describedby': descId,
      'data-testid': 'import-modal',
    },
    children: [
      el('div', {
        className: 'modal__header',
        children: [
          el('div', {
            className: 'modal__title-wrap',
            children: [
              el('span', {
                className: 'modal__badge',
                children: [createIcon('upload', 16)],
              }),
              el('div', {
                children: [
                  el('h2', {
                    id: titleId,
                    className: 'modal__title',
                    text: 'Importar contatos (JSON)',
                  }),
                  el('p', {
                    id: descId,
                    className: 'modal__subtitle',
                    text: 'Validação de schema, sanitização e controle de duplicados antes de aplicar.',
                  }),
                ],
              }),
            ],
          }),
          el('button', {
            className: 'modal__close',
            attrs: { type: 'button', 'aria-label': 'Fechar importação' },
            children: [createIcon('close', 18)],
            on: { click: closeModal },
          }),
        ],
      }),
      el('div', {
        className: 'import-body',
        children: [
          el('label', {
            className: 'import-drop',
            attrs: { for: 'import-file-input' },
            children: [
              createIcon('upload', 22),
              el('span', {
                className: 'import-drop__title',
                text: 'Selecione um arquivo .json exportado pela Agenda',
              }),
              el('span', {
                className: 'import-drop__hint',
                text: 'Máximo 2 MB · Compatível com formato v1 e listas legadas.',
              }),
              fileInput,
            ],
          }),
          statusBox,
          el('fieldset', {
            className: 'strategy-group',
            children: [
              el('legend', {
                className: 'field__label',
                text: 'Estratégia para telefones repetidos',
              }),
              el('label', {
                className: 'strategy-option',
                attrs: { for: 'strategy-merge' },
                children: [
                  mergeRadio,
                  el('span', {
                    children: [
                      el('strong', { text: 'Mesclar e ignorar duplicados' }),
                      el('small', {
                        text: 'Mantém seus contatos atuais e adiciona apenas números inéditos.',
                      }),
                    ],
                  }),
                ],
              }),
              el('label', {
                className: 'strategy-option',
                attrs: { for: 'strategy-replace' },
                children: [
                  replaceRadio,
                  el('span', {
                    children: [
                      el('strong', { text: 'Substituir agenda atual' }),
                      el('small', {
                        text: 'Exige confirmação e troca toda a lista pelos contatos importados.',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      el('div', {
        className: 'modal__footer',
        children: [
          el('button', {
            className: 'btn btn--ghost',
            text: 'Cancelar',
            attrs: { type: 'button' },
            on: { click: closeModal },
          }),
          confirmBtn,
        ],
      }),
    ],
  });

  const backdrop = el('div', {
    className: 'modal-backdrop',
    children: [panel],
    on: {
      click: (event) => {
        if (event.target === backdrop) {
          closeModal();
        }
      },
    },
  });

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeModal();
      return;
    }

    if (event.key === 'Tab') {
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  document.body.appendChild(backdrop);
  document.addEventListener('keydown', handleKeyDown, true);
  animateModalOpen(panel);
  fileInput.focus();
}
