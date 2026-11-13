import { el } from './dom';
import { createIcon } from './icons';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastController {
  show(message: string, tone?: ToastTone): void;
}

export function createToastManager(
  container: HTMLElement,
  liveRegion: HTMLElement,
): ToastController {
  let counter = 0;

  return {
    show(message: string, tone: ToastTone = 'info'): void {
      counter += 1;
      const toastId = `toast-${counter}`;

      // Announce to screen readers immediately
      liveRegion.textContent = '';
      requestAnimationFrame(() => {
        liveRegion.textContent = message;
      });

      const iconName =
        tone === 'success' ? 'check' : tone === 'error' ? 'alert' : 'shield';

      const dismiss = () => {
        toastEl.classList.add('toast-leaving');
        window.setTimeout(() => {
          toastEl.remove();
        }, 180);
      };

      const toastEl = el('div', {
        id: toastId,
        className: `toast toast--${tone}`,
        attrs: {
          role: tone === 'error' ? 'alert' : 'status',
          'data-testid': 'toast-notification',
        },
        children: [
          el('span', {
            className: 'toast__icon',
            children: [createIcon(iconName, 16)],
          }),
          el('span', {
            className: 'toast__message',
            text: message,
          }),
          el('button', {
            className: 'toast__close',
            attrs: {
              type: 'button',
              'aria-label': 'Fechar notificação',
            },
            children: [createIcon('close', 14)],
            on: { click: dismiss },
          }),
        ],
      });

      // Keep at most 2 concurrent toasts visible so UI controls stay unobstructed
      while (container.childElementCount >= 2) {
        container.firstElementChild?.remove();
      }
      container.appendChild(toastEl);

      window.setTimeout(() => {
        if (toastEl.isConnected) {
          dismiss();
        }
      }, 4200);
    },
  };
}
