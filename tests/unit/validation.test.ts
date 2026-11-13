import { describe, expect, it } from 'vitest';
import type { Contact } from '../../src/domain/contact';
import {
  containsUnsafeMarkup,
  MAX_FIELD_LENGTHS,
  validateContactDraft,
  validateEmail,
} from '../../src/domain/validation';

const EXISTING: Contact[] = [
  {
    id: 'c-1',
    nome: 'Ana Beatriz',
    telefone: '(11) 98765-4321',
    telefoneNormalizado: '+5511987654321',
    email: 'ana@exemplo.com',
    categoria: 'trabalho',
    favorito: true,
    criadoEm: '2026-01-10T10:00:00.000Z',
    atualizadoEm: '2026-01-10T10:00:00.000Z',
  },
];

describe('contact validation rules', () => {
  it('accepts valid Brazilian and international names with accents and punctuation', () => {
    const names = [
      'José Ângelo da Silva',
      "François O'Connor",
      'Łukasz Żółć',
      'María-José Núñez',
    ];

    names.forEach((nome, index) => {
      const result = validateContactDraft(
        {
          nome,
          telefone: `(21) 99876-540${index}`,
          email: 'valido@dominio.com.br',
          categoria: 'pessoal',
          observacoes: 'Contato confiável',
          favorito: false,
        },
        EXISTING,
      );
      expect(result.ok).toBe(true);
      expect(result.sanitizedDraft?.nome).toBe(nome);
    });
  });

  it('rejects empty, whitespace-only, too short, and oversized fields', () => {
    const empty = validateContactDraft({ nome: '   ', telefone: '' }, EXISTING);
    expect(empty.ok).toBe(false);
    expect(empty.errors.nome).toBeTruthy();
    expect(empty.errors.telefone).toBeTruthy();

    const short = validateContactDraft({ nome: 'A', telefone: '11999998888' }, EXISTING);
    expect(short.ok).toBe(false);
    expect(short.errors.nome).toContain('2 caracteres');

    const tooLong = validateContactDraft(
      {
        nome: 'X'.repeat(MAX_FIELD_LENGTHS.nome + 1),
        telefone: '1'.repeat(MAX_FIELD_LENGTHS.telefone + 1),
        email: `${'a'.repeat(MAX_FIELD_LENGTHS.email)}@b.com`,
        observacoes: 'N'.repeat(MAX_FIELD_LENGTHS.observacoes + 1),
      },
      EXISTING,
    );
    expect(tooLong.ok).toBe(false);
    expect(tooLong.errors.nome).toBeTruthy();
    expect(tooLong.errors.telefone).toBeTruthy();
    expect(tooLong.errors.email).toBeTruthy();
    expect(tooLong.errors.observacoes).toBeTruthy();
  });

  it('prevents duplicate phone numbers after normalization on create, but allows keeping own number on edit', () => {
    const dup = validateContactDraft(
      { nome: 'Clone', telefone: '+55 11 98765 4321' },
      EXISTING,
    );
    expect(dup.ok).toBe(false);
    expect(dup.errors.telefone).toContain('Ana Beatriz');

    const selfEdit = validateContactDraft(
      { nome: 'Ana Beatriz Atualizada', telefone: '11987654321' },
      EXISTING,
      'c-1',
    );
    expect(selfEdit.ok).toBe(true);
  });

  it('validates email and category cleanly', () => {
    expect(validateEmail('')).toBeNull();
    expect(validateEmail('invalido@')).toBeTruthy();
    expect(validateEmail('ok@empresa.dev')).toBeNull();

    const badCat = validateContactDraft(
      {
        nome: 'Teste',
        telefone: '(11) 91234-5678',
        categoria: 'hacker' as never,
      },
      EXISTING,
    );
    expect(badCat.ok).toBe(false);
    expect(badCat.errors.categoria).toBeTruthy();
  });

  it('detects and blocks HTML tags, scripts, and event handlers in all text inputs', () => {
    const payloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      'javascript:alert(document.cookie)',
      'Nome onclick=alert(1)',
    ];

    for (const payload of payloads) {
      expect(containsUnsafeMarkup(payload)).toBe(true);
      const res = validateContactDraft(
        {
          nome: payload,
          telefone: payload,
          email: payload,
          observacoes: payload,
        },
        EXISTING,
      );
      expect(res.ok).toBe(false);
      expect(res.errors.nome).toBeTruthy();
      expect(res.errors.telefone).toBeTruthy();
      expect(res.errors.email).toBeTruthy();
      expect(res.errors.observacoes).toBeTruthy();
    }
  });
});
