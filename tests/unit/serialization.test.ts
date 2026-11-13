import { describe, expect, it } from 'vitest';
import type { Contact } from '../../src/domain/contact';
import {
  CURRENT_SCHEMA_VERSION,
  deserializeContactsPayload,
  safeJsonParse,
  serializeContactsEnvelope,
} from '../../src/domain/serialization';

const SAMPLE_CONTACTS: Contact[] = [
  {
    id: 'id-1',
    nome: 'Lucas Pereira',
    telefone: '(11) 98765-4321',
    telefoneNormalizado: '+5511987654321',
    email: 'lucas@exemplo.com',
    categoria: 'trabalho',
    observacoes: 'Arquiteto de software',
    favorito: true,
    criadoEm: '2026-01-10T10:00:00.000Z',
    atualizadoEm: '2026-01-11T10:00:00.000Z',
  },
];

describe('serialization and schema migration', () => {
  it('round-trips versioned v1 envelope', () => {
    const json = serializeContactsEnvelope(SAMPLE_CONTACTS, '2026-01-11T12:00:00.000Z');
    const result = deserializeContactsPayload(json);
    expect(result.ok).toBe(true);
    expect(result.skippedInvalidCount).toBe(0);
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0]).toMatchObject({
      id: 'id-1',
      nome: 'Lucas Pereira',
      telefoneNormalizado: '+5511987654321',
      favorito: true,
    });
  });

  it('migrates legacy v0 array payloads safely and assigns ids/timestamps', () => {
    const legacyJson = JSON.stringify([
      { nome: 'Contato Legado', telefone: '11999990000' },
      { nome: 'Invalido', telefone: 'abc' },
    ]);
    const result = deserializeContactsPayload(legacyJson, '2026-02-01T00:00:00.000Z');
    expect(result.ok).toBe(true);
    expect(result.migratedFromVersion).toBe(0);
    expect(result.skippedInvalidCount).toBe(1);
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0]?.id).toBeTruthy();
    expect(result.contacts[0]?.criadoEm).toBe('2026-02-01T00:00:00.000Z');
  });

  it('rejects malformed JSON and unsupported future schema versions', () => {
    expect(deserializeContactsPayload('{invalid').ok).toBe(false);
    expect(
      deserializeContactsPayload(
        JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 5, contacts: [] }),
      ).ok,
    ).toBe(false);
    expect(deserializeContactsPayload(JSON.stringify({ wrong: true })).ok).toBe(false);
  });

  it('prevents prototype pollution from malicious JSON keys', () => {
    const maliciousJson =
      '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted2":"yes"}},"schemaVersion":1,"contacts":[{"nome":"Seguro","telefone":"11988887777","__proto__":{"isAdmin":true}}]}';
    const parsed = safeJsonParse(maliciousJson);
    expect(parsed.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted2).toBeUndefined();

    const deserialized = deserializeContactsPayload(maliciousJson);
    expect(deserialized.ok).toBe(true);
    expect(deserialized.contacts).toHaveLength(1);
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
  });

  it('deduplicates repeated normalized phones and colliding ids inside a payload', () => {
    const json = JSON.stringify({
      schemaVersion: 0,
      contacts: [
        { id: 'dup-id', nome: 'Primeiro', telefone: '11987654321', categoria: 'pessoal' },
        { id: 'dup-id', nome: 'Segundo', telefone: '11987650000', email: 'seg@ok.com', observacoes: 'Nota' },
        { nome: 'Terceiro', telefone: '(11) 98765-4321' },
        'not-an-object',
        { nome: 'A', telefone: '11999991111' },
      ],
    });
    const res = deserializeContactsPayload(json);
    expect(res.ok).toBe(true);
    expect(res.migratedFromVersion).toBe(0);
    expect(res.contacts).toHaveLength(2);
    expect(res.contacts[0]?.id).toBe('dup-id');
    expect(res.contacts[1]?.id).not.toBe('dup-id');
    expect(res.skippedInvalidCount).toBe(3);
  });
});
