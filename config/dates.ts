/** Convert a workspace wall-clock value to UTC, independently of the browser zone. */
export function workspaceDateToUtc(value: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('Escolha uma data e hora válidas.');
  const wall = Date.parse(value + 'Z');
  if (!Number.isFinite(wall)) throw new Error('Data inválida.');
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const format = (n: number) => {
    const p = Object.fromEntries(formatter.formatToParts(n).map((p) => [p.type, p.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  };
  let instant = wall;
  for (let i = 0; i < 4; i++) instant += wall - Date.parse(format(instant) + 'Z');
  if (format(instant) !== value) throw new Error('Este horário não existe no fuso escolhido.');
  return new Date(instant).toISOString();
}
