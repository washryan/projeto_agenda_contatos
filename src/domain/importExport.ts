import { CONTACT_CATEGORIES, type Contact } from './contact';
import {
  deserializeContactsPayload,
  serializeContactsEnvelope,
} from './serialization';
import { containsUnsafeMarkup, validateEmail } from './validation';

export type ImportStrategy = 'merge-skip' | 'replace';

export interface ImportPreview {
  readonly ok: boolean;
  readonly validContacts: Contact[];
  readonly skippedInvalidCount: number;
  readonly duplicateInExistingCount: number;
  readonly newContactsCount: number;
  readonly error?: string;
}

export interface ImportApplyResult {
  readonly contacts: Contact[];
  readonly addedCount: number;
  readonly skippedDuplicatesCount: number;
  readonly replacedTotal: boolean;
}

const FORMULA_INJECTION_PREFIX = /^[=+\-@\t\r]/;

const CATEGORY_LABEL_MAP = new Map(
  CONTACT_CATEGORIES.map((c) => [c.value, c.label]),
);

/**
 * Neutralizes spreadsheet formula injection (CWE-1236) and applies RFC 4180 CSV quoting.
 */
export function sanitizeCsvCell(value: string): string {
  const safe = FORMULA_INJECTION_PREFIX.test(value) ? `'${value}` : value;
  const escaped = safe.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Exports contacts to a UTF-8 BOM CSV compatible with Excel and Google Sheets.
 */
export function exportContactsToCsv(contacts: readonly Contact[]): string {
  const header = [
    'Nome',
    'Telefone',
    'Telefone Normalizado',
    'E-mail',
    'Categoria',
    'Favorito',
    'Observações',
    'Criado em',
    'Atualizado em',
  ]
    .map(sanitizeCsvCell)
    .join(',');

  const rows = contacts.map((contact) => {
    const categoryLabel = contact.categoria
      ? CATEGORY_LABEL_MAP.get(contact.categoria) ?? contact.categoria
      : '';
    return [
      contact.nome,
      contact.telefone,
      contact.telefoneNormalizado,
      contact.email ?? '',
      categoryLabel,
      contact.favorito ? 'Sim' : 'Não',
      contact.observacoes ?? '',
      contact.criadoEm,
      contact.atualizadoEm,
    ]
      .map(sanitizeCsvCell)
      .join(',');
  });

  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

/**
 * Exports contacts to a versioned JSON string.
 */
export function exportContactsToJson(contacts: readonly Contact[]): string {
  return serializeContactsEnvelope(contacts);
}

/**
 * Parses and validates an imported JSON payload against security rules and existing contacts.
 */
export function previewJsonImport(
  rawJson: string,
  existingContacts: readonly Contact[],
): ImportPreview {
  if (!rawJson.trim()) {
    return {
      ok: false,
      validContacts: [],
      skippedInvalidCount: 0,
      duplicateInExistingCount: 0,
      newContactsCount: 0,
      error: 'O arquivo JSON está vazio.',
    };
  }

  const parsed = deserializeContactsPayload(rawJson);
  if (!parsed.ok) {
    return {
      ok: false,
      validContacts: [],
      skippedInvalidCount: parsed.skippedInvalidCount,
      duplicateInExistingCount: 0,
      newContactsCount: 0,
      error: parsed.error ?? 'Arquivo JSON inválido.',
    };
  }

  const safeContacts: Contact[] = [];
  let extraRejected = 0;

  for (const contact of parsed.contacts) {
    if (
      containsUnsafeMarkup(contact.nome) ||
      containsUnsafeMarkup(contact.telefone) ||
      (contact.email && (containsUnsafeMarkup(contact.email) || validateEmail(contact.email) !== null)) ||
      (contact.observacoes && containsUnsafeMarkup(contact.observacoes))
    ) {
      extraRejected += 1;
      continue;
    }
    safeContacts.push(contact);
  }

  const totalSkipped = parsed.skippedInvalidCount + extraRejected;
  if (safeContacts.length === 0) {
    return {
      ok: false,
      validContacts: [],
      skippedInvalidCount: totalSkipped,
      duplicateInExistingCount: 0,
      newContactsCount: 0,
      error: 'Nenhum contato válido foi encontrado no arquivo importado.',
    };
  }

  const existingPhones = new Set(existingContacts.map((c) => c.telefoneNormalizado));
  let duplicateInExistingCount = 0;
  let newContactsCount = 0;

  for (const contact of safeContacts) {
    if (existingPhones.has(contact.telefoneNormalizado)) {
      duplicateInExistingCount += 1;
    } else {
      newContactsCount += 1;
    }
  }

  return {
    ok: true,
    validContacts: safeContacts,
    skippedInvalidCount: totalSkipped,
    duplicateInExistingCount,
    newContactsCount,
  };
}

/**
 * Applies a validated import preview using the chosen conflict resolution strategy.
 */
export function applyJsonImport(
  existingContacts: readonly Contact[],
  importedContacts: readonly Contact[],
  strategy: ImportStrategy,
): ImportApplyResult {
  if (strategy === 'replace') {
    return {
      contacts: [...importedContacts],
      addedCount: importedContacts.length,
      skippedDuplicatesCount: 0,
      replacedTotal: true,
    };
  }

  const existingPhones = new Set(existingContacts.map((c) => c.telefoneNormalizado));
  const additions: Contact[] = [];
  let skippedDuplicatesCount = 0;

  for (const contact of importedContacts) {
    if (existingPhones.has(contact.telefoneNormalizado)) {
      skippedDuplicatesCount += 1;
      continue;
    }
    existingPhones.add(contact.telefoneNormalizado);
    additions.push(contact);
  }

  return {
    contacts: [...existingContacts, ...additions],
    addedCount: additions.length,
    skippedDuplicatesCount,
    replacedTotal: false,
  };
}
