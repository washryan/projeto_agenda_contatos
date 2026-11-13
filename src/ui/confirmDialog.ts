import { animateModalOpen } from './animations';
import { el } from './dom';
import { createIcon } from './icons';

export interface ConfirmDialogOptions {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly danger?: boolean;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const titleId = `confirm-title-${Date.now()}`;
    const descId = `confirm-desc-${Date.now()}`;

    let settled = false;
    const finish = (confirmed: boolean) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', handleKeyDown, true);
      backdrop.remove();
      previouslyFocused?.focus();
      resolve(confirmed);
    };

    const cancelBtn = el('button', {
      className: 'btn btn--ghost',
      text: options.cancelLabel ?? 'Cancelar',
      attrs: { type: 'button', 'data-testid': 'confirm-cancel' },
      on: { click: () => finish(false) },
    });

    const confirmBtn = el('button', {
      className: options.danger ? 'btn btn--danger' : 'btn btn--primary',
      text: options.confirmLabel,
      attrs: { type: 'button', 'data-testid': 'confirm-accept' },
      on: { click: () => finish(true) },
    });

    const closeBtn = el('button', {
      className: 'modal__close',
      attrs: { type: 'button', 'aria-label': 'Fechar diálogo de confirmação' },
      children: [createIcon('close', 18)],
      on: { click: () => finish(false) },
    });

    const panel = el('div', {
      className: 'modal modal--compact',
      attrs: {
        role: 'alertdialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        'aria-describedby': descId,
        'data-testid': 'confirm-dialog',
      },
      children: [
        el('div', {
          className: 'modal__header',
          children: [
            el('div', {
              className: 'modal__title-wrap',
              children: [
                el('span', {
                  className: options.danger
                    ? 'modal__badge modal__badge--danger'
                    : 'modal__badge',
                  children: [createIcon('alert', 16)],
                }),
                el('h2', { id: titleId, className: 'modal__title', text: options.title }),
              ],
            }),
            closeBtn,
          ],
        }),
        el('p', {
          id: descId,
          className: 'modal__description',
          text: options.description,
        }),
        el('div', {
          className: 'modal__footer',
          children: [cancelBtn, confirmBtn],
        }),
      ],
    });

    const backdrop = el('div', {
      className: 'modal-backdrop',
      children: [panel],
      on: {
        click: (event) => {
          if (event.target === backdrop) {
            finish(false);
          }
        },
      },
    });

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
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
    cancelBtn.focus();
  });
}
