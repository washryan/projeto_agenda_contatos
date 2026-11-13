import { describe, expect, it } from 'vitest';
import type { Contact } from '../../src/domain/contact';
import {
  computeContactStats,
  queryContacts,
  sortContacts,
} from '../../src/domain/searchFilterSort';

const CONTACTS: Contact[] = [
  {
    id: '1',
    nome: 'Carlos Eduardo',
    telefone: '(11) 99999-1111',
    telefoneNormalizado: '+5511999991111',
    email: 'carlos@studio.dev',
    categoria: 'trabalho',
    favorito: false,
    criadoEm: '2026-01-01T10:00:00.000Z',
    atualizadoEm: '2026-01-02T10:00:00.000Z',
  },
  {
    id: '2',
    nome: 'Ágata Souza',
    telefone: '(21) 98888-2222',
    telefoneNormalizado: '+5521988882222',
    email: 'agata@familia.org',
    categoria: 'familia',
    favorito: true,
    criadoEm: '2026-01-03T10:00:00.000Z',
    atualizadoEm: '2026-01-05T10:00:00.000Z',
  },
  {
    id: '3',
    nome: 'Bruno Álvares',
    telefone: '(31) 97777-3333',
    telefoneNormalizado: '+5531977773333',
    categoria: 'cliente',
    favorito: true,
    criadoEm: '2026-01-02T10:00:00.000Z',
    atualizadoEm: '2026-01-04T10:00:00.000Z',
  },
];

describe('search, filter, sort, and stats', () => {
  it('searches by name (accent-insensitive), phone digits, formatted phone, and email', () => {
    expect(
      queryContacts(CONTACTS, {
        busca: 'agata',
        somenteFavoritos: false,
        categoria: 'todas',
        ordenacao: 'nome-asc',
      }).map((c) => c.id),
    ).toEqual(['2']);

    expect(
      queryContacts(CONTACTS, {
        busca: '977773333',
        somenteFavoritos: false,
        categoria: 'todas',
        ordenacao: 'nome-asc',
      }).map((c) => c.id),
    ).toEqual(['3']);

    expect(
      queryContacts(CONTACTS, {
        busca: 'STUDIO.DEV',
        somenteFavoritos: false,
        categoria: 'todas',
        ordenacao: 'nome-asc',
      }).map((c) => c.id),
    ).toEqual(['1']);
  });

  it('filters by favorites and category', () => {
    const filtered = queryContacts(CONTACTS, {
      busca: '',
      somenteFavoritos: true,
      categoria: 'cliente',
      ordenacao: 'nome-asc',
    });
    expect(filtered.map((c) => c.id)).toEqual(['3']);
  });

  it('sorts A-Z, Z-A, criado-desc, and atualizado-desc', () => {
    expect(sortContacts(CONTACTS, 'nome-asc').map((c) => c.id)).toEqual(['2', '3', '1']);
    expect(sortContacts(CONTACTS, 'nome-desc').map((c) => c.id)).toEqual(['1', '3', '2']);
    expect(sortContacts(CONTACTS, 'criado-desc').map((c) => c.id)).toEqual(['2', '3', '1']);
    expect(sortContacts(CONTACTS, 'atualizado-desc').map((c) => c.id)).toEqual(['2', '3', '1']);
  });

  it('computes accurate counters from real data', () => {
    const visible = CONTACTS.slice(0, 2);
    expect(computeContactStats(CONTACTS, visible)).toEqual({
      total: 3,
      favoritos: 2,
      categoriasAtivas: 3,
      visiveis: 2,
    });
  });
});
