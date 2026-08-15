/**
 * Stooq daily closes. Free, keyless, undocumented — and because it is
 * undocumented it fails in ways that look like success: an HTML page, a
 * one-line hit-limit message, or a header with no rows. Each is detected
 * here rather than written to the database as zero rows and forgotten.
 *
 * ── The fix in this version ────────────────────────────────────────
 *
 * Every symbol started failing at once with "the symbol is probably
 * wrong", including IBM, MSFT and AMZN. They were not wrong. Stooq now
 * answers automated clients with a JavaScript proof-of-work interstitial:
 * HTTP 200, `text/html`, a script that hashes a challenge string until it
 * finds a SHA-256 prefix of four zeroes, posts the nonce to `/__verify`
 * and reloads. It is served on the first request, on both stooq.com and
 * stooq.pl, with or without a User-Agent, so it is neither a rate limit
 * nor a symbol problem.
 *
 * The parser could not say that, because it classified every response
 * beginning with `<` as a bad symbol. So a single source-wide change of
 * policy was reported twenty times as twenty unrelated data-entry errors,
 * pointing at the one explanation that was certainly false.
 *
 * Failures are now classified. A `kind` distinguishes a problem with the
 * source from a problem with the symbol, and `isSourceLevel` lets the
 * caller stop after the first one instead of asking twenty more times.
 */

export function stooqUrl(symbol: string): string {
  return `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;
}

export interface PricePoint { date: string; close: number; }

/**
 * Why a response could not be turned into prices.
 *
 * `challenge` and `hit_limit` describe the source and are true for every
 * symbol at once. The rest describe one response and say nothing about
 * the next symbol.
 */
export type StooqFailureKind =
  | 'challenge'
  | 'hit_limit'
  | 'empty'
  | 'html'
  | 'bad_header'
  | 'missing_column'
  | 'no_rows'
  | 'http';

/** Failures that are about Stooq, not about the symbol asked for. */
const SOURCE_LEVEL: ReadonlySet<StooqFailureKind> = new Set<StooqFailureKind>(['challenge', 'hit_limit', 'http']);

export class StooqError extends Error {
  readonly kind: StooqFailureKind;

  constructor(message: string, kind: StooqFailureKind = 'html') {
    super(message);
    this.name = 'StooqError';
    this.kind = kind;
  }

  /**
   * True when retrying a different symbol cannot help. The caller uses
   * this to report one problem rather than one per company.
   */
  get isSourceLevel(): boolean {
    return SOURCE_LEVEL.has(this.kind);
  }
}

/**
 * Recognise the browser-verification interstitial.
 *
 * Matched on behaviour rather than on wording: the page names the
 * endpoint it wants the nonce posted to, and it always ships the hashing
 * loop. Either marker alone is enough, so a copy change or a translated
 * `<noscript>` string does not silently turn this back into "the symbol
 * is probably wrong".
 */
export function isChallengePage(body: string): boolean {
  return (
    /__verify/.test(body) ||
    /crypto\.subtle\.digest/.test(body) ||
    /requires JavaScript to verify your browser/i.test(body)
  );
}

export function parseStooqCsv(text: string, sinceIso = '2021-01-01'): PricePoint[] {
  const body = (text ?? '').trim();

  if (!body) throw new StooqError('Stooq returned an empty body.', 'empty');

  if (isChallengePage(body)) {
    throw new StooqError(
      'Stooq answered with a browser-verification page instead of data. It now requires ' +
        'a JavaScript proof-of-work challenge to be solved before it serves CSV, which a ' +
        'scheduled fetch cannot do. This affects every symbol, not this one.',
      'challenge',
    );
  }

  if (/exceeded the daily hits limit/i.test(body)) {
    throw new StooqError('Stooq daily hit limit reached. Prices will resume on the next run.', 'hit_limit');
  }

  if (/^</.test(body)) {
    throw new StooqError('Stooq returned HTML, not CSV. The symbol is probably wrong.', 'html');
  }

  const lines = body.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].toLowerCase();
  if (!header.startsWith('date')) {
    throw new StooqError(`Unexpected Stooq header: ${lines[0].slice(0, 80)}`, 'bad_header');
  }

  const cols = header.split(',');
  const dateIdx = cols.indexOf('date');
  const closeIdx = cols.indexOf('close');
  if (dateIdx === -1 || closeIdx === -1) {
    throw new StooqError('Stooq CSV is missing a Date or Close column.', 'missing_column');
  }

  const out: PricePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const date = parts[dateIdx]?.trim();
    const raw = parts[closeIdx]?.trim();
    if (!date || !raw) continue;
    if (raw === 'N/D' || raw === '-') continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (date < sinceIso) continue;
    const close = Number(raw);
    if (!Number.isFinite(close)) continue;
    out.push({ date, close });
  }

  if (out.length === 0) {
    throw new StooqError('Stooq CSV parsed but contained no usable rows in the requested window.', 'no_rows');
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchPrices(symbol: string, sinceIso?: string): Promise<PricePoint[]> {
  const res = await fetch(stooqUrl(symbol), {
    headers: { 'User-Agent': 'ai-outcome-ledger/1.0', Accept: 'text/csv,*/*' },
  });
  if (!res.ok) throw new StooqError(`Stooq returned ${res.status} for ${symbol}`, 'http');
  return parseStooqCsv(await res.text(), sinceIso);
}

/**
 * One live request, used by the smoke check.
 *
 * Deliberately separate from `fetchPrices`: this reports how the source
 * is behaving, so it must return the diagnosis rather than throw it.
 */
export async function probeStooq(symbol = 'ibm.us'): Promise<
  { ok: true; symbol: string; rows: number; latest: string } | { ok: false; symbol: string; kind: StooqFailureKind; message: string }
> {
  try {
    const points = await fetchPrices(symbol);
    return { ok: true, symbol, rows: points.length, latest: points[points.length - 1]!.date };
  } catch (err: any) {
    const kind: StooqFailureKind = err instanceof StooqError ? err.kind : 'http';
    return { ok: false, symbol, kind, message: String(err?.message ?? err) };
  }
}
