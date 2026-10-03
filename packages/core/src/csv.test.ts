import { it, expect } from 'vitest';
import { parseCsv, writeCsv } from './csv';
it('parses quoted CSV with BOM, multiline cells and escaped quotes', () => {
  expect(
    parseCsv(
      '\uFEFFnome,email\r\n"Ana, Silva","ana@example.com"\r\n"João ""J""\nSilva",joao@example.com',
    ),
  ).toEqual({
    headers: ['nome', 'email'],
    rows: [
      { nome: 'Ana, Silva', email: 'ana@example.com' },
      { nome: 'João "J"\nSilva', email: 'joao@example.com' },
    ],
  });
});
it('rejects broken quotes, duplicate headings and wrong column counts', () => {
  for (const text of [
    'nome,nome\nAna,Ana',
    'nome,email\n"Ana',
    'nome,email\nAna',
    'nome\n"Ana"oops',
  ])
    expect(() => parseCsv(text)).toThrow();
});
it('exports safe spreadsheet cells and preserves literal commas and quotes', () => {
  const csv = writeCsv(
    ['nome', 'telefone'],
    [
      ['=IMPORTXML("x")', '+5511999999999'],
      ['Ana, "Silva"', null],
    ],
  );
  expect(csv).toContain("'=");
  expect(csv).toContain("'+5511999999999");
  expect(parseCsv(csv).rows[1]?.nome).toBe('Ana, "Silva"');
});
