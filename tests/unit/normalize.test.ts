import { describe, expect, it } from 'vitest';
import {
  collapseWhitespace,
  extractDigits,
  isWhatsAppCompatible,
  normalizePhone,
  normalizeSearchText,
} from '../../src/domain/normalize';

describe('normalize domain utilities', () => {
  it('collapses whitespace and normalizes search text without accents or case sensitivity', () => {
    expect(collapseWhitespace('  Ryan   Leal  ')).toBe('Ryan Leal');
    expect(normalizeSearchText('  José   Ângelo Ção  ')).toBe('jose angelo cao');
    expect(extractDigits('(11) 98765-4321')).toBe('11987654321');
  });

  it('normalizes Brazilian mobile numbers in multiple formats to one canonical E.164 key', () => {
    const formats = [
      '11987654321',
      '(11) 98765-4321',
      '+55 11 98765-4321',
      '5511987654321',
      '11 98765.4321',
    ];

    for (const raw of formats) {
      const res = normalizePhone(raw);
      expect(res.ok).toBe(true);
      expect(res.canonical).toBe('+5511987654321');
      expect(res.display).toBe('(11) 98765-4321');
      expect(res.telHref).toBe('tel:+5511987654321');
      expect(res.whatsappHref).toBe('https://wa.me/5511987654321');
    }
  });

  it('normalizes Brazilian landlines and disables WhatsApp link for non-mobile numbers', () => {
    const res = normalizePhone('1133334444');
    expect(res.ok).toBe(true);
    expect(res.canonical).toBe('+551133334444');
    expect(res.display).toBe('(11) 3333-4444');
    expect(res.telHref).toBe('tel:+551133334444');
    expect(res.whatsappHref).toBeNull();
    expect(isWhatsAppCompatible('+551133334444')).toBe(false);
    expect(isWhatsAppCompatible('11987654321')).toBe(false);
  });

  it('accepts valid international E.164 numbers and enables WhatsApp', () => {
    const res = normalizePhone('+1 (415) 555-0199');
    expect(res.ok).toBe(true);
    expect(res.canonical).toBe('+14155550199');
    expect(res.telHref).toBe('tel:+14155550199');
    expect(res.whatsappHref).toBe('https://wa.me/14155550199');
  });

  it('rejects invalid phones with clear Portuguese messages', () => {
    expect(normalizePhone('').ok).toBe(false);
    expect(normalizePhone('11987abc321').ok).toBe(false);
    expect(normalizePhone('11+987654321').ok).toBe(false);
    expect(normalizePhone('01987654321').ok).toBe(false);
    expect(normalizePhone('11111111111').ok).toBe(false);
    expect(normalizePhone('11887654321').ok).toBe(false);
    expect(normalizePhone('+55 11 999').ok).toBe(false);
    expect(normalizePhone('+1234').ok).toBe(false);
    expect(normalizePhone('12345').ok).toBe(false);
  });
});
