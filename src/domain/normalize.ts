export interface NormalizedPhoneResult {
  readonly ok: boolean;
  readonly canonical: string;
  readonly display: string;
  readonly telHref: string | null;
  readonly whatsappHref: string | null;
  readonly error?: string;
}

const ALLOWED_PHONE_CHARS = /^[0-9+\-().\s]+$/;
const ALL_SAME_DIGIT = /^(\d)\1+$/;

/**
 * Collapses repeated whitespace and trims leading/trailing spaces.
 */
export function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes text for accent- and case-insensitive search and sorting.
 */
export function normalizeSearchText(value: string): string {
  return collapseWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Extracts only ASCII digits from a phone string.
 */
export function extractDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formats a 10- or 11-digit Brazilian phone number (without country code).
 */
export function formatBrazilianNationalPhone(nationalDigits: string): string {
  const ddd = nationalDigits.slice(0, 2);
  if (nationalDigits.length === 11) {
    return `(${ddd}) ${nationalDigits.slice(2, 7)}-${nationalDigits.slice(7)}`;
  }
  return `(${ddd}) ${nationalDigits.slice(2, 6)}-${nationalDigits.slice(6)}`;
}

/**
 * Checks whether a canonical E.164 phone number is compatible with WhatsApp links.
 * Brazilian landlines (10 national digits) are excluded; BR 11-digit mobiles and
 * international E.164 numbers (8-15 digits) are considered compatible.
 */
export function isWhatsAppCompatible(canonical: string): boolean {
  if (!canonical.startsWith('+')) {
    return false;
  }
  const digits = extractDigits(canonical);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const national = digits.slice(2);
    return national.length === 11 && national[2] === '9';
  }
  return digits.length >= 8 && digits.length <= 15;
}

function validateBrazilianNational(national: string): NormalizedPhoneResult | null {
  if (national.length !== 10 && national.length !== 11) {
    return null;
  }

  const ddd = Number(national.slice(0, 2));
  if (ddd < 11 || ddd > 99) {
    return {
      ok: false,
      canonical: '',
      display: '',
      telHref: null,
      whatsappHref: null,
      error: 'Informe um DDD brasileiro válido (entre 11 e 99).',
    };
  }

  if (ALL_SAME_DIGIT.test(national)) {
    return {
      ok: false,
      canonical: '',
      display: '',
      telHref: null,
      whatsappHref: null,
      error: 'Informe um número de telefone válido (não repetido).',
    };
  }

  if (national.length === 11 && national[2] !== '9') {
    return {
      ok: false,
      canonical: '',
      display: '',
      telHref: null,
      whatsappHref: null,
      error: 'Celular com 11 dígitos deve iniciar com 9 após o DDD.',
    };
  }

  const canonical = `+55${national}`;
  const display = formatBrazilianNationalPhone(national);
  const whatsappHref = isWhatsAppCompatible(canonical)
    ? `https://wa.me/55${national}`
    : null;

  return {
    ok: true,
    canonical,
    display,
    telHref: `tel:${canonical}`,
    whatsappHref,
  };
}

/**
 * Normalizes and validates Brazilian and international E.164 phone numbers.
 */
export function normalizePhone(raw: string): NormalizedPhoneResult {
  const trimmed = collapseWhitespace(raw);
  if (!trimmed) {
    return {
      ok: false,
      canonical: '',
      display: '',
      telHref: null,
      whatsappHref: null,
      error: 'Informe o telefone do contato.',
    };
  }

  if (!ALLOWED_PHONE_CHARS.test(trimmed)) {
    return {
      ok: false,
      canonical: '',
      display: '',
      telHref: null,
      whatsappHref: null,
      error: 'O telefone contém caracteres inválidos. Use apenas números, +, (), - e espaços.',
    };
  }

  const hasLeadingPlus = trimmed.startsWith('+');
  if (trimmed.indexOf('+', 1) !== -1) {
    return {
      ok: false,
      canonical: '',
      display: '',
      telHref: null,
      whatsappHref: null,
      error: 'O sinal + só pode aparecer no início do código do país.',
    };
  }

  const digits = extractDigits(trimmed);

  if (hasLeadingPlus) {
    if (digits.startsWith('55')) {
      const national = digits.slice(2);
      const brResult = validateBrazilianNational(national);
      if (brResult) {
        return brResult;
      }
      return {
        ok: false,
        canonical: '',
        display: '',
        telHref: null,
        whatsappHref: null,
        error: 'Número brasileiro com +55 deve ter DDD + 8 ou 9 dígitos.',
      };
    }

    if (digits.length < 8 || digits.length > 15 || ALL_SAME_DIGIT.test(digits)) {
      return {
        ok: false,
        canonical: '',
        display: '',
        telHref: null,
        whatsappHref: null,
        error: 'Número internacional inválido. Informe entre 8 e 15 dígitos após o +.',
      };
    }

    const canonical = `+${digits}`;
    return {
      ok: true,
      canonical,
      display: trimmed,
      telHref: `tel:${canonical}`,
      whatsappHref: `https://wa.me/${digits}`,
    };
  }

  // Without leading +: handle 55+DDD+number (12 or 13 digits) or national 10/11 digits
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const brWithCountry = validateBrazilianNational(digits.slice(2));
    if (brWithCountry) {
      return brWithCountry;
    }
  }

  const brNational = validateBrazilianNational(digits);
  if (brNational) {
    return brNational;
  }

  return {
    ok: false,
    canonical: '',
    display: '',
    telHref: null,
    whatsappHref: null,
    error: 'Telefone inválido. Use DDD + número (ex.: (11) 99999-8888) ou formato internacional (+...).',
  };
}
