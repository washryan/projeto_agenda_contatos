import {
  CONTACT_CATEGORIES,
  type Contact,
  type ContactCategory,
  type ContactDraft,
  type ValidationErrors,
} from './contact';
import { collapseWhitespace, normalizePhone, type NormalizedPhoneResult } from './normalize';

export const MAX_FIELD_LENGTHS = {
  nome: 100,
  telefone: 24,
  email: 160,
  observacoes: 500,
} as const;

const HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9-]*(\s[^>]*)?\/?>|<!--[\s\S]*?-->/i;
const SCRIPT_URI_OR_HANDLER_PATTERN = /\b(?:javascript|vbscript|data:text\/html)\s*:|\bon(?:error|load|click|dblclick|mouseover|focus|blur|input|submit)\s*=/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const VALID_CATEGORY_SET = new Set<string>(CONTACT_CATEGORIES.map((c) => c.value));

export interface ValidatedContactResult {
  readonly ok: boolean;
  readonly errors: ValidationErrors;
  readonly normalizedPhone?: NormalizedPhoneResult;
  readonly sanitizedDraft?: {
    readonly nome: string;
    readonly telefone: string;
    readonly telefoneNormalizado: string;
    readonly email?: string;
    readonly categoria?: ContactCategory;
    readonly observacoes?: string;
    readonly favorito: boolean;
  };
}

/**
 * Detects HTML markup, inline script handlers, or executable URI schemes in user input.
 */
export function containsUnsafeMarkup(value: string): boolean {
  return HTML_TAG_PATTERN.test(value) || SCRIPT_URI_OR_HANDLER_PATTERN.test(value);
}

/**
 * Validates an optional email string. Returns an error message or null when valid.
 */
export function validateEmail(rawEmail: string): string | null {
  const email = rawEmail.trim();
  if (!email) {
    return null;
  }
  if (email.length > MAX_FIELD_LENGTHS.email) {
    return `O e-mail deve ter no máximo ${MAX_FIELD_LENGTHS.email} caracteres.`;
  }
  if (containsUnsafeMarkup(email)) {
    return 'Não utilize tags HTML ou scripts no e-mail.';
  }
  if (!EMAIL_PATTERN.test(email)) {
    return 'Informe um endereço de e-mail válido (ex.: nome@dominio.com).';
  }
  return null;
}

/**
 * Validates a contact draft against all domain, security, length, and uniqueness rules.
 */
export function validateContactDraft(
  draft: ContactDraft,
  existingContacts: readonly Contact[],
  editingId?: string,
): ValidatedContactResult {
  const errors: ValidationErrors = {};

  const nome = collapseWhitespace(draft.nome ?? '');
  if (!nome) {
    errors.nome = 'Informe o nome do contato.';
  } else if (containsUnsafeMarkup(nome)) {
    errors.nome = 'Não utilize tags HTML ou scripts no nome.';
  } else if (nome.length < 2) {
    errors.nome = 'O nome deve ter pelo menos 2 caracteres.';
  } else if (nome.length > MAX_FIELD_LENGTHS.nome) {
    errors.nome = `O nome deve ter no máximo ${MAX_FIELD_LENGTHS.nome} caracteres.`;
  }

  const rawTelefone = collapseWhitespace(draft.telefone ?? '');
  let phoneResult: NormalizedPhoneResult | undefined;

  if (!rawTelefone) {
    errors.telefone = 'Informe o telefone do contato.';
  } else if (containsUnsafeMarkup(rawTelefone)) {
    errors.telefone = 'Não utilize tags HTML ou scripts no telefone.';
  } else if (rawTelefone.length > MAX_FIELD_LENGTHS.telefone) {
    errors.telefone = `O telefone deve ter no máximo ${MAX_FIELD_LENGTHS.telefone} caracteres.`;
  } else {
    phoneResult = normalizePhone(rawTelefone);
    if (!phoneResult.ok) {
      errors.telefone = phoneResult.error ?? 'Telefone inválido.';
    } else {
      const duplicate = existingContacts.find(
        (c) => c.telefoneNormalizado === phoneResult?.canonical && c.id !== editingId,
      );
      if (duplicate) {
        errors.telefone = `Este telefone já está cadastrado para "${duplicate.nome}".`;
      }
    }
  }

  const rawEmail = (draft.email ?? '').trim();
  const emailError = validateEmail(rawEmail);
  if (emailError) {
    errors.email = emailError;
  }

  const rawCategoria = draft.categoria ?? '';
  let categoria: ContactCategory | undefined;
  if (rawCategoria !== '') {
    if (!VALID_CATEGORY_SET.has(rawCategoria)) {
      errors.categoria = 'Selecione uma categoria válida.';
    } else {
      categoria = rawCategoria;
    }
  }

  const observacoes = (draft.observacoes ?? '').trim();
  if (observacoes) {
    if (containsUnsafeMarkup(observacoes)) {
      errors.observacoes = 'Não utilize tags HTML ou scripts nas observações.';
    } else if (observacoes.length > MAX_FIELD_LENGTHS.observacoes) {
      errors.observacoes = `As observações devem ter no máximo ${MAX_FIELD_LENGTHS.observacoes} caracteres.`;
    }
  }

  const hasErrors = Object.keys(errors).length > 0;
  if (hasErrors || !phoneResult || !phoneResult.ok) {
    return {
      ok: false,
      errors,
      ...(phoneResult ? { normalizedPhone: phoneResult } : {}),
    };
  }

  return {
    ok: true,
    errors: {},
    normalizedPhone: phoneResult,
    sanitizedDraft: {
      nome,
      telefone: phoneResult.display,
      telefoneNormalizado: phoneResult.canonical,
      ...(rawEmail ? { email: rawEmail } : {}),
      ...(categoria ? { categoria } : {}),
      ...(observacoes ? { observacoes } : {}),
      favorito: Boolean(draft.favorito),
    },
  };
}
