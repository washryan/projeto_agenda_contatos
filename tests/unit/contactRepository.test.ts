import { describe, expect, it } from 'vitest';
import type { Contact } from '../../src/domain/contact';
import {
  CORRUPTED_BACKUP_KEY,
  ContactRepository,
  STORAGE_KEY,
  type StorageLike,
} from '../../src/storage/contactRepository';

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  public throwOnSet = false;
  public quotaError = false;

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.quotaError) {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    }
    if (this.throwOnSet) {
      throw new Error('Storage write failed');
    }
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const CONTACT: Contact = {
  id: 'ct-1',
  nome: 'Mariana Costa',
  telefone: '(11) 98765-1234',
  telefoneNormalizado: '+5511987651234',
  favorito: false,
  criadoEm: '2026-01-10T10:00:00.000Z',
  atualizadoEm: '2026-01-10T10:00:00.000Z',
};

describe('ContactRepository persistence and error recovery', () => {
  it('saves and loads contacts cleanly across repository instances', () => {
    const storage = new MemoryStorage();
    const repo1 = new ContactRepository(storage);
    expect(repo1.isPersistentStorageAvailable()).toBe(true);
    expect(repo1.load().status).toBe('empty');

    expect(repo1.save([CONTACT]).ok).toBe(true);

    const repo2 = new ContactRepository(storage);
    const loaded = repo2.load();
    expect(loaded.status).toBe('ok');
    expect(loaded.contacts).toHaveLength(1);
    expect(loaded.contacts[0]?.nome).toBe('Mariana Costa');
  });

  it('migrates legacy v0 storage payloads automatically', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ nome: 'Legado Silva', telefone: '11988886666' }]),
    );

    const repo = new ContactRepository(storage);
    const loaded = repo.load();
    expect(loaded.status).toBe('migrated');
    expect(loaded.contacts).toHaveLength(1);
    expect(storage.getItem(STORAGE_KEY)).toContain('"schemaVersion": 1');
  });

  it('preserves corrupted data in backup key instead of silently discarding it', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{corrupted_json');

    const repo = new ContactRepository(storage);
    const loaded = repo.load();
    expect(loaded.status).toBe('corrupted');
    expect(loaded.rawBackup).toBe('{corrupted_json');
    expect(storage.getItem(CORRUPTED_BACKUP_KEY)).toBe('{corrupted_json');

    repo.clearCorruptedBackup();
    expect(storage.getItem(CORRUPTED_BACKUP_KEY)).toBeNull();
  });

  it('handles QuotaExceededError and unavailable storage gracefully', () => {
    const storage = new MemoryStorage();
    storage.quotaError = true;
    const repo = new ContactRepository(storage);

    const saveRes = repo.save([CONTACT]);
    expect(saveRes.ok).toBe(false);
    expect(saveRes.error).toContain('Limite de espaço');

    const memoryOnlyRepo = new ContactRepository(null);
    expect(memoryOnlyRepo.isPersistentStorageAvailable()).toBe(false);
    expect(memoryOnlyRepo.load().status).toBe('unavailable');
    expect(memoryOnlyRepo.save([CONTACT]).ok).toBe(false);
    expect(memoryOnlyRepo.load().contacts).toHaveLength(1);
    memoryOnlyRepo.clearCorruptedBackup();

    // Generic storage write/read exceptions
    storage.quotaError = false;
    storage.throwOnSet = true;
    const genericSaveFail = repo.save([CONTACT]);
    expect(genericSaveFail.ok).toBe(false);
    expect(genericSaveFail.error).toContain('Erro ao gravar');

    const throwingGetStorage: StorageLike = {
      getItem: () => {
        throw new Error('Blocked');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    const brokenReadRepo = new ContactRepository(throwingGetStorage);
    expect(brokenReadRepo.load().status).toBe('unavailable');

    // Default window.localStorage resolution in jsdom
    window.localStorage.clear();
    const defaultRepo = new ContactRepository();
    expect(defaultRepo.isPersistentStorageAvailable()).toBe(true);
    expect(defaultRepo.load().status).toBe('empty');
  });
});
