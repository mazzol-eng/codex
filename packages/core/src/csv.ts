export function parseCsv(input: string) {
  const text = input.replace(/^\uFEFF/, '');
  if (text.length > 200000) throw new Error('CSV muito grande. Use até 200 KB por importação.');
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  const endCell = () => {
    row.push(cell);
    cell = '';
    closed = false;
    if (row.length > 50) throw new Error('Use até 50 colunas.');
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim())) rows.push(row);
    row = [];
    if (rows.length > 1001) throw new Error('Importe até 1.000 contatos por arquivo.');
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw new Error('Aspas inválidas no CSV.');
      quoted = true;
    } else if (c === ',') endCell();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else {
      if (closed && !/\s/.test(c)) throw new Error('Coluna inválida no CSV.');
      if (!closed) cell += c;
    }
  }
  if (quoted) throw new Error('Feche as aspas no CSV.');
  if (cell || row.length || closed) endRow();
  const headers = rows.shift()?.map((h) => h.trim()) ?? [];
  if (!headers.length || headers.some((h) => !h) || new Set(headers).size !== headers.length)
    throw new Error('O cabeçalho precisa ter nomes únicos.');
  if (rows.some((r) => r.length !== headers.length))
    throw new Error('Todas as linhas precisam ter o mesmo número de colunas.');
  return { headers, rows: rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]!]))) };
}
export function writeCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
) {
  const cell = (v: string | number | boolean | null | undefined) => {
    let s = String(v ?? '');
    if (/^[\s]*[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}
