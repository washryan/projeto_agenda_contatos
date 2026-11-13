import {
  type Contact,
  type ContactFilters,
  type ContactStats,
  type SortOption,
} from './contact';
import { extractDigits, normalizeSearchText } from './normalize';

const PT_COLLATOR = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/**
 * Checks whether a single contact matches the active search query, favorite toggle, and category filter.
 */
export function matchesContactFilters(contact: Contact, filters: ContactFilters): boolean {
  if (filters.somenteFavoritos && !contact.favorito) {
    return false;
  }

  if (filters.categoria !== 'todas' && contact.categoria !== filters.categoria) {
    return false;
  }

  const rawQuery = filters.busca.trim();
  if (!rawQuery) {
    return true;
  }

  const normalizedQuery = normalizeSearchText(rawQuery);
  const queryDigits = extractDigits(rawQuery);

  const nameMatches = normalizeSearchText(contact.nome).includes(normalizedQuery);
  if (nameMatches) {
    return true;
  }

  const emailMatches = contact.email
    ? normalizeSearchText(contact.email).includes(normalizedQuery)
    : false;
  if (emailMatches) {
    return true;
  }

  const formattedPhoneMatches = normalizeSearchText(contact.telefone).includes(normalizedQuery);
  if (formattedPhoneMatches) {
    return true;
  }

  if (queryDigits.length > 0) {
    const contactDigits = extractDigits(contact.telefoneNormalizado);
    const localDigits = extractDigits(contact.telefone);
    if (contactDigits.includes(queryDigits) || localDigits.includes(queryDigits)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns a new sorted array according to the selected SortOption without mutating the input.
 */
export function sortContacts(contacts: readonly Contact[], sortBy: SortOption): Contact[] {
  const copy = [...contacts];

  copy.sort((a, b) => {
    switch (sortBy) {
      case 'nome-asc':
        return PT_COLLATOR.compare(a.nome, b.nome);
      case 'nome-desc':
        return PT_COLLATOR.compare(b.nome, a.nome);
      case 'criado-desc':
        return b.criadoEm.localeCompare(a.criadoEm) || PT_COLLATOR.compare(a.nome, b.nome);
      case 'atualizado-desc':
        return b.atualizadoEm.localeCompare(a.atualizadoEm) || PT_COLLATOR.compare(a.nome, b.nome);
    }
  });

  return copy;
}

/**
 * Filters and sorts contacts in one pure deterministic pass.
 */
export function queryContacts(
  contacts: readonly Contact[],
  filters: ContactFilters,
): Contact[] {
  const filtered = contacts.filter((contact) => matchesContactFilters(contact, filters));
  return sortContacts(filtered, filters.ordenacao);
}

/**
 * Computes true live statistics from stored contacts and currently visible results.
 */
export function computeContactStats(
  allContacts: readonly Contact[],
  visibleContacts: readonly Contact[],
): ContactStats {
  const activeCategories = new Set(
    allContacts.map((c) => c.categoria).filter((cat): cat is NonNullable<typeof cat> => Boolean(cat)),
  );

  return {
    total: allContacts.length,
    favoritos: allContacts.filter((c) => c.favorito).length,
    categoriasAtivas: activeCategories.size,
    visiveis: visibleContacts.length,
  };
}
