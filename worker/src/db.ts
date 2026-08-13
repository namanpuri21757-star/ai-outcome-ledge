import type { Env } from './types';

/**
 * A deliberately tiny PostgREST client.
 *
 * ── The fix in this version ────────────────────────────────────────
 *
 * `select` now paginates. The previous version issued one unbounded
 * request per query and trusted the response to be complete.
 *
 * PostgREST applies a server-side row cap and answers a request that
 * exceeds it with HTTP 200 and a truncated body. There is no error and
 * no warning — the caller simply receives fewer rows than exist and has
 * no way to tell.
 *
 * That is almost certainly what emptied the outcomes job. A company with
 * daily price history carries well over a thousand observations, mostly
 * prices; ordered by date ascending, a truncated page ends somewhere in
 * the middle of the series and every recent quarter is missing. Claims
 * dated in the last eighteen months then find no baseline reading, so no
 * outcome row is written, so every margin figure in the interface reads
 * as a dash — with a run that reports success and zero errors.
 *
 * Paginating with an explicit Range header removes the failure mode
 * entirely, and `lastPageWasFull` lets a caller assert that it saw
 * everything rather than assuming it.
 */

const PAGE = 1000;

export class Db {
  /** Set after each select: true when the final page came back full,
   *  which means the server may still be holding rows back. */
  lastPageWasFull = false;

  constructor(private env: Env) {}

  private get base(): string {
    return this.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1';
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  /**
   * Fetch every matching row, a page at a time.
   *
   * `maxPages` is a guard rather than a limit: a query that needs more
   * than fifty pages is a bug in the caller, and looping forever against
   * a paid API is worse than stopping.
   */
  async select<T = any>(table: string, query = '', maxPages = 50): Promise<T[]> {
    const out: T[] = [];
    this.lastPageWasFull = false;

    for (let page = 0; page < maxPages; page++) {
      const from = page * PAGE;
      const to = from + PAGE - 1;
      const url = `${this.base}/${table}${query ? '?' + query : ''}`;

      const res = await fetch(url, {
        headers: this.headers({ Range: `${from}-${to}`, 'Range-Unit': 'items' }),
      });
      if (!res.ok && res.status !== 206) {
        throw new Error(`select ${table} failed ${res.status}: ${await res.text()}`);
      }

      const batch = (await res.json()) as T[];
      out.push(...batch);

      if (batch.length < PAGE) return out;
      if (page === maxPages - 1) this.lastPageWasFull = true;
    }

    return out;
  }

  /** Insert, and on a unique-constraint hit update instead. */
  async upsert(table: string, rows: any[], onConflict?: string, chunk = 500): Promise<number> {
    let written = 0;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
      const res = await fetch(`${this.base}/${table}${qs}`, {
        method: 'POST',
        headers: this.headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(slice),
      });
      if (!res.ok) throw new Error(`upsert ${table} failed ${res.status}: ${await res.text()}`);
      written += slice.length;
    }
    return written;
  }

  async insertReturning<T = any>(table: string, row: any): Promise<T> {
    const res = await fetch(`${this.base}/${table}`, {
      method: 'POST',
      headers: this.headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`insert ${table} failed ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as T[];
    return body[0];
  }

  async patch(table: string, query: string, patch: any): Promise<void> {
    const res = await fetch(`${this.base}/${table}?${query}`, {
      method: 'PATCH',
      headers: this.headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`patch ${table} failed ${res.status}: ${await res.text()}`);
  }
}

/** Batch rows into chunks. Exported because the boundary is worth testing. */
export function chunk<T>(rows: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be positive');
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
