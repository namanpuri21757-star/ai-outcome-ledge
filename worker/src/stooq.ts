/**
 * Stooq daily close prices. Free, keyless, undocumented.
 *
 * Because it is undocumented it fails in ways that look like success: an HTML
 * page, a one-line "Exceeded the daily hits limit" body, or a header with no
 * rows. Each of those is detected and raised here rather than being written
 * to the database as zero rows and forgotten.
 */

export function stooqUrl(symbol: string): string {
  return `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;
}

export interface PricePoint {
  date: string;
  close: number;
}

export class StooqError extends Error {}

export function parseStooqCsv(text: string, sinceIso = '2021-01-01'): PricePoint[] {
  const body = (text ?? '').trim();

  if (!body) throw new StooqError('Stooq returned an empty body.');
  if (/^</.test(body)) throw new StooqError('Stooq returned HTML, not CSV. The symbol is probably wrong.');
  if (/exceeded the daily hits limit/i.test(body)) {
    throw new StooqError('Stooq daily hit limit reached. Prices will resume on the next run.');
  }

  const lines = body.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].toLowerCase();
  if (!header.startsWith('date')) {
    throw new StooqError(`Unexpected Stooq header: ${lines[0].slice(0, 80)}`);
  }

  const cols = header.split(',');
  const dateIdx = cols.indexOf('date');
  const closeIdx = cols.indexOf('close');
  if (dateIdx === -1 || closeIdx === -1) {
    throw new StooqError('Stooq CSV is missing a Date or Close column.');
  }

  const out: PricePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const date = parts[dateIdx]?.trim();
    const raw = parts[closeIdx]?.trim();
    if (!date || !raw) continue;
    if (raw === 'N/D' || raw === '-') continue; // Stooq's null markers
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (date < sinceIso) continue;
    const close = Number(raw);
    if (!Number.isFinite(close)) continue;
    out.push({ date, close });
  }

  if (out.length === 0) {
    throw new StooqError('Stooq CSV parsed but contained no usable rows in the requested window.');
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchPrices(symbol: string, sinceIso?: string): Promise<PricePoint[]> {
  const res = await fetch(stooqUrl(symbol), {
    headers: { 'User-Agent': 'ai-outcome-ledger/1.0', Accept: 'text/csv,*/*' },
  });
  if (!res.ok) throw new StooqError(`Stooq returned ${res.status} for ${symbol}`);
  return parseStooqCsv(await res.text(), sinceIso);
}
