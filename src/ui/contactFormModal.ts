import {
  CONTACT_CATEGORIES,
  type Contact,
  type ContactCategory,
  type ContactDraft,
  type ContactField,
  type ValidationErrors,
} from '../domain/contact';
import { MAX_FIELD_LENGTHS, validateContactDraft } from '../domain/validation';
import { animateModalOpen } from './animations';
import { el } from './dom';
import { createIcon } from './icons';

export interface ContactFormModalOptions {
  readonly mode: 'create' | 'edit';
  readonly contact?: Contact;
  readonly existingContacts: readonly Contact[];
  readonly onSave: (draft: ContactDraft, editingId?: string) => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openContactFormModal(options: ContactFormModalOptions): void {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const isEdit = options.mode === 'edit' && options.contact !== undefined;
  const editingId = options.contact?.id;

  const titleId = 'contact-modal-title';
  const descId = 'contact-modal-desc';

  const nomeInput = el('input', {
    id: 'contact-nome',
    className: 'field__control',
    attrs: {
      type: 'text',
      name: 'nome',
      required: true,
      maxlength: MAX_FIELD_LENGTHS.nome,
      autocomplete: 'name',
      placeholder: 'Ex.: Maria Clara Souza',
      value: options.contact?.nome ?? '',
      'aria-describedby': 'error-nome',
    },
  });

  const telefoneInput = el('input', {
    id: 'contact-telefone',
    className: 'field__control',
    attrs: {
      type: 'tel',
      name: 'telefone',
      required: true,
      maxlength: MAX_FIELD_LENGTHS.telefone,
      autocomplete: 'tel',
      placeholder: 'Ex.: (11) 99999-8888 ou +55 11 99999-8888',
      value: options.contact?.telefone ?? '',
      'aria-describedby': 'hint-telefone error-telefone',
    },
  });

  const emailInput = el('input', {
    id: 'contact-email',
    className: 'field__control',
    attrs: {
      type: 'email',
      name: 'email',
      maxlength: MAX_FIELD_LENGTHS.email,
      autocomplete: 'email',
      placeholder: 'Ex.: maria@exemplo.com',
      value: options.contact?.email ?? '',
      'aria-describedby': 'error-email',
    },
  });

  const categoriaSelect = el('select', {
    id: 'contact-categoria',
    className: 'field__control',
    attrs: {
      name: 'categoria',
      'aria-describedby': 'error-categoria',
    },
    children: [
      el('option', { text: 'Sem categoria', attrs: { value: '' } }),
      ...CONTACT_CATEGORIES.map((cat) =>
        el('option', {
          text: cat.label,
          attrs: {
            value: cat.value,
            selected: options.contact?.categoria === cat.value,
          },
        }),
      ),
    ],
  });

  const observacoesInput = el('textarea', {
    id: 'contact-observacoes',
    className: 'field__control field__textarea',
    text: options.contact?.observacoes ?? '',
    attrs: {
      name: 'observacoes',
      rows: 3,
      maxlength: MAX_FIELD_LENGTHS.observacoes,
      placeholder: 'Empresa, contexto, horário preferido ou anotação rápida...',
      'aria-describedby': 'hint-observacoes error-observacoes',
    },
  });

  const favoritoCheckbox = el('input', {
    id: 'contact-favorito',
    className: 'toggle-check__input',
    attrs: {
      type: 'checkbox',
      name: 'favorito',
      checked: options.contact?.favorito ?? false,
    },
  });

  const errorEls: Record<ContactField, HTMLElement> = {
    nome: el('p', { id: 'error-nome', className: 'field__error', attrs: { role: 'alert' } }),
    telefone: el('p', { id: 'error-telefone', className: 'field__error', attrs: { role: 'alert' } }),
    email: el('p', { id: 'error-email', className: 'field__error', attrs: { role: 'alert' } }),
    categoria: el('p', { id: 'error-categoria', className: 'field__error', attrs: { role: 'alert' } }),
    observacoes: el('p', {
      id: 'error-observacoes',
      className: 'field__error',
      attrs: { role: 'alert' },
    }),
  };

  const controlMap: Record<ContactField, HTMLElement> = {
    nome: nomeInput,
    telefone: telefoneInput,
    email: emailInput,
    categoria: categoriaSelect,
    observacoes: observacoesInput,
  };

  function renderErrors(errors: ValidationErrors): void {
    const fields: ContactField[] = ['nome', 'telefone', 'email', 'categoria', 'observacoes'];
    let firstInvalid: HTMLElement | null = null;

    for (const field of fields) {
      const msg = errors[field] ?? '';
      errorEls[field].textContent = msg;
      const ctrl = controlMap[field];
      if (msg) {
        ctrl.setAttribute('aria-invalid', 'true');
        ctrl.classList.add('field__control--invalid');
        if (!firstInvalid) firstInvalid = ctrl;
      } else {
        ctrl.removeAttribute('aria-invalid');
        ctrl.classList.remove('field__control--invalid');
      }
    }

    firstInvalid?.focus();
  }

  function clearFieldError(field: ContactField): void {
    if (!errorEls[field].textContent) return;
    errorEls[field].textContent = '';
    controlMap[field].removeAttribute('aria-invalid');
    controlMap[field].classList.remove('field__control--invalid');
  }

  nomeInput.addEventListener('input', () => clearFieldError('nome'));
  telefoneInput.addEventListener('input', () => clearFieldError('telefone'));
  emailInput.addEventListener('input', () => clearFieldError('email'));
  categoriaSelect.addEventListener('change', () => clearFieldError('categoria'));
  observacoesInput.addEventListener('input', () => clearFieldError('observacoes'));

  const notesCountHint = el('span', {
    id: 'hint-observacoes',
    className: 'field__hint',
    text: `${observacoesInput.value.length}/${MAX_FIELD_LENGTHS.observacoes} caracteres`,
  });

  observacoesInput.addEventListener('input', () => {
    notesCountHint.textContent = `${observacoesInput.value.length}/${MAX_FIELD_LENGTHS.observacoes} caracteres`;
  });

  function closeModal(): void {
    document.removeEventListener('keydown', handleKeyDown, true);
    backdrop.remove();
    previouslyFocused?.focus();
  }

  const form = el('form', {
    className: 'contact-form',
    attrs: { novalidate: true, 'data-testid': 'contact-form' },
    children: [
      el('div', {
        className: 'field',
        children: [
          el('label', {
            className: 'field__label',
            text: 'Nome completo *',
            attrs: { for: 'contact-nome' },
          }),
          nomeInput,
          errorEls.nome,
        ],
      }),
      el('div', {
        className: 'form-grid',
        children: [
          el('div', {
            className: 'field',
            children: [
              el('label', {
                className: 'field__label',
                text: 'Telefone *',
                attrs: { for: 'contact-telefone' },
              }),
              telefoneInput,
              el('span', {
                id: 'hint-telefone',
                className: 'field__hint',
                text: 'Aceita DDD + número ou formato internacional (+código).',
              }),
              errorEls.telefone,
            ],
          }),
          el('div', {
            className: 'field',
            children: [
              el('label', {
                className: 'field__label',
                text: 'Categoria',
                attrs: { for: 'contact-categoria' },
              }),
              categoriaSelect,
              errorEls.categoria,
            ],
          }),
        ],
      }),
      el('div', {
        className: 'field',
        children: [
          el('label', {
            className: 'field__label',
            text: 'E-mail',
            attrs: { for: 'contact-email' },
          }),
          emailInput,
          errorEls.email,
        ],
      }),
      el('div', {
        className: 'field',
        children: [
          el('label', {
            className: 'field__label',
            text: 'Observações',
            attrs: { for: 'contact-observacoes' },
          }),
          observacoesInput,
          notesCountHint,
          errorEls.observacoes,
        ],
      }),
      el('label', {
        className: 'toggle-check',
        attrs: { for: 'contact-favorito' },
        children: [
          favoritoCheckbox,
          el('span', { className: 'toggle-check__box', attrs: { 'aria-hidden': 'true' } }),
          el('span', {
            className: 'toggle-check__label',
            text: 'Marcar como contato favorito',
          }),
        ],
      }),
      el('div', {
        className: 'modal__footer',
        children: [
          el('button', {
            className: 'btn btn--ghost',
            text: 'Cancelar',
            attrs: { type: 'button', 'data-testid': 'contact-cancel' },
            on: { click: closeModal },
          }),
          el('button', {
            className: 'btn btn--primary',
            text: isEdit ? 'Salvar alterações' : 'Adicionar contato',
            attrs: { type: 'submit', 'data-testid': 'contact-submit' },
          }),
        ],
      }),
    ],
    on: {
      submit: (event) => {
        event.preventDefault();
        const draft: ContactDraft = {
          nome: nomeInput.value,
          telefone: telefoneInput.value,
          email: emailInput.value,
          categoria: (categoriaSelect.value as ContactCategory | '') || '',
          observacoes: observacoesInput.value,
          favorito: favoritoCheckbox.checked,
        };

        const result = validateContactDraft(draft, options.existingContacts, editingId);
        if (!result.ok) {
          renderErrors(result.errors);
          return;
        }

        closeModal();
        options.onSave(draft, editingId);
      },
    },
  });

  const panel = el('div', {
    className: 'modal',
    attrs: {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      'aria-describedby': descId,
      'data-testid': 'contact-modal',
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
                children: [createIcon(isEdit ? 'edit' : 'plus', 16)],
              }),
              el('div', {
                children: [
                  el('h2', {
                    id: titleId,
                    className: 'modal__title',
                    text: isEdit ? 'Editar contato' : 'Nova conexão',
                  }),
                  el('p', {
                    id: descId,
                    className: 'modal__subtitle',
                    text: isEdit
                      ? 'Atualize os dados do contato selecionado.'
                      : 'Preencha os campos para registrar um novo contato na agenda local.',
                  }),
                ],
              }),
            ],
          }),
          el('button', {
            className: 'modal__close',
            attrs: { type: 'button', 'aria-label': 'Fechar formulário de contato' },
            children: [createIcon('close', 18)],
            on: { click: closeModal },
          }),
        ],
      }),
      form,
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
  nomeInput.focus();
}
