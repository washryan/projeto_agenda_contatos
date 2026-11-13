import { describe, expect, it } from 'vitest';
import type { Contact } from '../../src/domain/contact';
import {
  applyJsonImport,
  exportContactsToCsv,
  exportContactsToJson,
  previewJsonImport,
  sanitizeCsvCell,
} from '../../src/domain/importExport';

const EXISTING: Contact[] = [
  {
    id: '1',
    nome: 'Ryan Leal',
    telefone: '(87) 99129-0104',
    telefoneNormalizado: '+5587991290104',
    email: 'ryan@exemplo.com',
    categoria: 'trabalho',
    observacoes: 'Nota "especial"',
    favorito: true,
    criadoEm: '2026-01-01T10:00:00.000Z',
    atualizadoEm: '2026-01-01T10:00:00.000Z',
  },
];

describe('import and export domain logic', () => {
  it('neutralizes CSV formula injection payloads and escapes quotes cleanly', () => {
    expect(sanitizeCsvCell('=CMD("calc")')).toBe(`"'=CMD(""calc"")"`);
    expect(sanitizeCsvCell('+5511999999999')).toBe(`"'+5511999999999"`);
    expect(sanitizeCsvCell('-1+1')).toBe(`"'-1+1"`);
    expect(sanitizeCsvCell('@SUM(A1:A2)')).toBe(`"'@SUM(A1:A2)"`);
    expect(sanitizeCsvCell('\t=1')).toBe(`"'\t=1"`);
    expect(sanitizeCsvCell('Normal "texto"')).toBe(`"Normal ""texto"""`);

    const csv = exportContactsToCsv([
      ...EXISTING,
      {
        ...EXISTING[0]!,
        id: '2',
        nome: '=HYPERLINK("http://evil.example","Clique")',
        telefone: '(11) 98888-7777',
        telefoneNormalizado: '+5511988887777',
      },
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""Clique"")"`);
    expect(csv).toContain(`"'+5587991290104"`);
  });

  it('exports and previews valid JSON imports while detecting duplicates and rejecting XSS records', () => {
    const exported = exportContactsToJson(EXISTING);
    const previewSame = previewJsonImport(exported, EXISTING);
    expect(previewSame.ok).toBe(true);
    expect(previewSame.duplicateInExistingCount).toBe(1);
    expect(previewSame.newContactsCount).toBe(0);

    const mixedPayload = JSON.stringify({
      schemaVersion: 1,
      contacts: [
        { nome: '<script>alert(1)</script>', telefone: '11911112222' },
        { nome: 'Novo Contato', telefone: '11933334444', email: 'novo@ok.com' },
        { nome: 'Ryan Duplicado', telefone: '87991290104' },
      ],
    });

    const previewMixed = previewJsonImport(mixedPayload, EXISTING);
    expect(previewMixed.ok).toBe(true);
    expect(previewMixed.validContacts).toHaveLength(2);
    expect(previewMixed.skippedInvalidCount).toBe(1);
    expect(previewMixed.newContactsCount).toBe(1);
    expect(previewMixed.duplicateInExistingCount).toBe(1);

    const merged = applyJsonImport(EXISTING, previewMixed.validContacts, 'merge-skip');
    expect(merged.contacts).toHaveLength(2);
    expect(merged.addedCount).toBe(1);
    expect(merged.skippedDuplicatesCount).toBe(1);

    const replaced = applyJsonImport(EXISTING, previewMixed.validContacts, 'replace');
    expect(replaced.contacts).toHaveLength(2);
    expect(replaced.replacedTotal).toBe(true);
  });

  it('rejects empty or fully invalid JSON imports', () => {
    expect(previewJsonImport('   ', EXISTING).ok).toBe(false);
    expect(previewJsonImport('{broken', EXISTING).ok).toBe(false);
    expect(
      previewJsonImport(
        JSON.stringify({
          schemaVersion: 1,
          contacts: [{ nome: '<img src=x onerror=alert(1)>', telefone: '11999998888' }],
        }),
        EXISTING,
      ).ok,
    ).toBe(false);
  });
});
