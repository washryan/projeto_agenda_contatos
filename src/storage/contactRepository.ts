import type { Contact } from '../domain/contact';
import {
  deserializeContactsPayload,
  serializeContactsEnvelope,
} from '../domain/serialization';

export const STORAGE_KEY = 'rl_agenda_contatos_v1';
export const CORRUPTED_BACKUP_KEY = 'rl_agenda_contatos_corrupted_backup';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadContactsStatus = 'ok' | 'empty' | 'migrated' | 'corrupted' | 'unavailable';

export interface LoadContactsResult {
  readonly status: LoadContactsStatus;
  readonly contacts: Contact[];
  readonly skippedInvalidCount: number;
  readonly error?: string;
  readonly rawBackup?: string;
}

export interface SaveContactsResult {
  readonly ok: boolean;
  readonly error?: string;
}

function resolveDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const probeKey = '__rl_storage_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Persistence adapter encapsulating localStorage access, schema recovery,
 * and safe error reporting without silent data loss.
 */
export class ContactRepository {
  private readonly storage: StorageLike | null;
  private memoryFallback: Contact[] = [];

  constructor(storage?: StorageLike | null) {
    this.storage = storage === undefined ? resolveDefaultStorage() : storage;
  }

  isPersistentStorageAvailable(): boolean {
    return this.storage !== null;
  }

  load(): LoadContactsResult {
    if (!this.storage) {
      return {
        status: 'unavailable',
        contacts: [...this.memoryFallback],
        skippedInvalidCount: 0,
        error:
          'O armazenamento local do navegador está indisponível. As alterações ficarão apenas nesta sessão.',
      };
    }

    let raw: string | null;
    try {
      raw = this.storage.getItem(STORAGE_KEY);
    } catch {
      return {
        status: 'unavailable',
        contacts: [...this.memoryFallback],
        skippedInvalidCount: 0,
        error: 'Não foi possível ler os dados salvos no navegador.',
      };
    }

    if (raw === null || raw.trim() === '') {
      return {
        status: 'empty',
        contacts: [],
        skippedInvalidCount: 0,
      };
    }

    const parsed = deserializeContactsPayload(raw);
    if (!parsed.ok) {
      // Preserve corrupted payload under a separate backup key so nothing is lost silently
      try {
        this.storage.setItem(CORRUPTED_BACKUP_KEY, raw);
      } catch {
        // Ignore secondary backup write failure; rawBackup is still returned in memory
      }

      return {
        status: 'corrupted',
        contacts: [],
        skippedInvalidCount: 0,
        rawBackup: raw,
        error:
          parsed.error ??
          'Os dados armazenados localmente estavam corrompidos. Um backup bruto foi preservado para recuperação.',
      };
    }

    this.memoryFallback = [...parsed.contacts];

    if (parsed.migratedFromVersion !== undefined) {
      this.save(parsed.contacts);
      return {
        status: 'migrated',
        contacts: parsed.contacts,
        skippedInvalidCount: parsed.skippedInvalidCount,
      };
    }

    return {
      status: 'ok',
      contacts: parsed.contacts,
      skippedInvalidCount: parsed.skippedInvalidCount,
    };
  }

  save(contacts: readonly Contact[]): SaveContactsResult {
    this.memoryFallback = [...contacts];

    if (!this.storage) {
      return {
        ok: false,
        error:
          'Armazenamento local indisponível. Os contatos permanecem apenas na memória desta aba.',
      };
    }

    try {
      const payload = serializeContactsEnvelope(contacts);
      this.storage.setItem(STORAGE_KEY, payload);
      return { ok: true };
    } catch (err) {
      const isQuota =
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');

      return {
        ok: false,
        error: isQuota
          ? 'Limite de espaço do navegador atingido. Exporte seus contatos em JSON para evitar perda de dados.'
          : 'Erro ao gravar contatos no armazenamento local do navegador.',
      };
    }
  }

  clearCorruptedBackup(): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(CORRUPTED_BACKUP_KEY);
    } catch {
      // Ignore cleanup failure
    }
  }
}
