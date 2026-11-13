export type ContactCategory = 'pessoal' | 'trabalho' | 'familia' | 'cliente' | 'outro';

export interface CategoryOption {
  readonly value: ContactCategory;
  readonly label: string;
}

export const CONTACT_CATEGORIES: readonly CategoryOption[] = [
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'familia', label: 'Família' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'outro', label: 'Outro' },
] as const;

export interface Contact {
  readonly id: string;
  readonly nome: string;
  readonly telefone: string;
  readonly telefoneNormalizado: string;
  readonly email?: string;
  readonly categoria?: ContactCategory;
  readonly observacoes?: string;
  readonly favorito: boolean;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface ContactDraft {
  readonly nome: string;
  readonly telefone: string;
  readonly email?: string;
  readonly categoria?: ContactCategory | '';
  readonly observacoes?: string;
  readonly favorito?: boolean;
}

export type ContactField = 'nome' | 'telefone' | 'email' | 'categoria' | 'observacoes';

export type ValidationErrors = Partial<Record<ContactField, string>>;

export type SortOption = 'nome-asc' | 'nome-desc' | 'criado-desc' | 'atualizado-desc';

export interface ContactFilters {
  readonly busca: string;
  readonly somenteFavoritos: boolean;
  readonly categoria: ContactCategory | 'todas';
  readonly ordenacao: SortOption;
}

export const DEFAULT_FILTERS: ContactFilters = {
  busca: '',
  somenteFavoritos: false,
  categoria: 'todas',
  ordenacao: 'nome-asc',
};

export interface ContactStats {
  readonly total: number;
  readonly favoritos: number;
  readonly categoriasAtivas: number;
  readonly visiveis: number;
}
