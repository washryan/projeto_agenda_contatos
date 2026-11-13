import {
  CONTACT_CATEGORIES,
  type Contact,
  type ContactCategory,
} from './contact';
import { collapseWhitespace, normalizePhone } from './normalize';

export const CURRENT_SCHEMA_VERSION = 1;

export interface StorageEnvelopeV1 {
  readonly schemaVersion: 1;
  readonly updatedAt: string;
  readonly contacts: readonly Contact[];
}

export interface DeserializationResult {
  readonly ok: boolean;
  readonly contacts: Contact[];
  readonly migratedFromVersion?: number;
  readonly skippedInvalidCount: number;
  readonly error?: string;
}

const VALID_CATEGORIES = new Set<string>(CONTACT_CATEGORIES.map((c) => c.value));
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Safely parses JSON while stripping dangerous prototype-pollution keys.
 */
export function safeJsonParse(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(raw, (key, value) => {
      if (FORBIDDEN_KEYS.has(key)) {
        return undefined;
      }
      return value;
    });
    return { ok: true, value: parsed };
  } catch {
    return {
      ok: false,
      error: 'O conteúdo JSON está malformado e não pôde ser interpretado.',
    };
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function generateFallbackId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseIsoOrNow(value: unknown, fallback: string): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return fallback;
}

/**
 * Validates and normalizes a single unknown record into a safe Contact object.
 * Also supports legacy v0 shape `{ nome, telefone }` without id/timestamps.
 */
export function coerceContactRecord(
  raw: unknown,
  nowIso: string = new Date().toISOString(),
): Contact | null {
  if (!isPlainRecord(raw)) {
    return null;
  }

  const rawNome = Object.hasOwn(raw, 'nome') ? raw.nome : undefined;
  const rawTelefone = Object.hasOwn(raw, 'telefone') ? raw.telefone : undefined;
  if (typeof rawNome !== 'string' || typeof rawTelefone !== 'string') {
    return null;
  }

  const nome = collapseWhitespace(rawNome);
  if (nome.length < 2 || nome.length > 100) {
    return null;
  }

  const phone = normalizePhone(rawTelefone);
  if (!phone.ok) {
    return null;
  }

  const rawId = Object.hasOwn(raw, 'id') ? raw.id : undefined;
  const id =
    typeof rawId === 'string' && rawId.trim().length > 0 && rawId.trim().length <= 80
      ? rawId.trim()
      : generateFallbackId();

  const rawEmail = Object.hasOwn(raw, 'email') ? raw.email : undefined;
  const email =
    typeof rawEmail === 'string' && rawEmail.trim().length > 0 && rawEmail.trim().length <= 160
      ? rawEmail.trim()
      : undefined;

  const rawCategoria = Object.hasOwn(raw, 'categoria') ? raw.categoria : undefined;
  const categoria: ContactCategory | undefined =
    typeof rawCategoria === 'string' && VALID_CATEGORIES.has(rawCategoria)
      ? (rawCategoria as ContactCategory)
      : undefined;

  const rawObservacoes = Object.hasOwn(raw, 'observacoes') ? raw.observacoes : undefined;
  const observacoes =
    typeof rawObservacoes === 'string' && rawObservacoes.trim().length > 0
      ? rawObservacoes.trim().slice(0, 500)
      : undefined;

  const rawFavorito = Object.hasOwn(raw, 'favorito') ? raw.favorito : undefined;
  const favorito = typeof rawFavorito === 'boolean' ? rawFavorito : false;

  const criadoEm = parseIsoOrNow(
    Object.hasOwn(raw, 'criadoEm') ? raw.criadoEm : undefined,
    nowIso,
  );
  const atualizadoEm = parseIsoOrNow(
    Object.hasOwn(raw, 'atualizadoEm') ? raw.atualizadoEm : undefined,
    criadoEm,
  );

  return {
    id,
    nome,
    telefone: phone.display,
    telefoneNormalizado: phone.canonical,
    ...(email ? { email } : {}),
    ...(categoria ? { categoria } : {}),
    ...(observacoes ? { observacoes } : {}),
    favorito,
    criadoEm,
    atualizadoEm,
  };
}

/**
 * Serializes contacts into the versioned v1 storage/export envelope.
 */
export function serializeContactsEnvelope(
  contacts: readonly Contact[],
  updatedAt: string = new Date().toISOString(),
): string {
  const envelope: StorageEnvelopeV1 = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt,
    contacts,
  };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Deserializes and migrates a stored or imported JSON payload safely.
 * Deduplicates by normalized phone number, keeping the first valid entry.
 */
export function deserializeContactsPayload(
  raw: string,
  nowIso: string = new Date().toISOString(),
): DeserializationResult {
  const parsed = safeJsonParse(raw);
  if (!parsed.ok) {
    return {
      ok: false,
      contacts: [],
      skippedInvalidCount: 0,
      error: parsed.error,
    };
  }

  let rawContacts: unknown[];
  let migratedFromVersion: number | undefined;

  if (Array.isArray(parsed.value)) {
    // Legacy v0 array format
    rawContacts = parsed.value;
    migratedFromVersion = 0;
  } else if (isPlainRecord(parsed.value)) {
    const version = Object.hasOwn(parsed.value, 'schemaVersion')
      ? parsed.value.schemaVersion
      : undefined;
    const contactsField = Object.hasOwn(parsed.value, 'contacts')
      ? parsed.value.contacts
      : undefined;

    if (typeof version !== 'number' || !Array.isArray(contactsField)) {
      return {
        ok: false,
        contacts: [],
        skippedInvalidCount: 0,
        error: 'Estrutura inválida: esperado objeto com "schemaVersion" e lista "contacts".',
      };
    }

    if (version > CURRENT_SCHEMA_VERSION) {
      return {
        ok: false,
        contacts: [],
        skippedInvalidCount: 0,
        error: `Versão de schema (${version}) não suportada por esta versão da aplicação.`,
      };
    }

    if (version < CURRENT_SCHEMA_VERSION) {
      migratedFromVersion = version;
    }

    rawContacts = contactsField;
  } else {
    return {
      ok: false,
      contacts: [],
      skippedInvalidCount: 0,
      error: 'Formato JSON inválido para agenda de contatos.',
    };
  }

  const seenPhones = new Set<string>();
  const seenIds = new Set<string>();
  const contacts: Contact[] = [];
  let skippedInvalidCount = 0;

  for (const item of rawContacts) {
    const coerced = coerceContactRecord(item, nowIso);
    if (!coerced) {
      skippedInvalidCount += 1;
      continue;
    }

    if (seenPhones.has(coerced.telefoneNormalizado)) {
      skippedInvalidCount += 1;
      continue;
    }

    const safeId = seenIds.has(coerced.id) ? generateFallbackId() : coerced.id;
    seenIds.add(safeId);
    seenPhones.add(coerced.telefoneNormalizado);
    contacts.push(safeId === coerced.id ? coerced : { ...coerced, id: safeId });
  }

  return {
    ok: true,
    contacts,
    ...(migratedFromVersion !== undefined ? { migratedFromVersion } : {}),
    skippedInvalidCount,
  };
}
