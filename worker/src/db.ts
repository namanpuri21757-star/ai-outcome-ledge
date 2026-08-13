import type { Env } from './types';

/**
 * A deliberately tiny PostgREST client.
 *
 * The Supabase JS SDK works on Workers, but this pipeline needs exactly four
 * verbs and no auth session handling. Dropping the dependency removes a whole
 * class of bundling and version-drift problems from a job that has to run
 * unattended on a schedule.
 *
 * The service role key bypasses row level security. It lives in the
 * Cloudflare secret store and must never be given to the browser.
 */

export class Db {
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

  async select<T = any>(table: string, query = ''): Promise<T[]> {
    const url = `${this.base}/${table}${query ? '?' + query : ''}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`select ${table} failed ${res.status}: ${await res.text()}`);
    return res.json();
  }

  /** Insert, and on a unique-constraint hit update instead. Requires the
   *  target table to have the matching unique index, which the schema defines. */
  async upsert(table: string, rows: any[], onConflict?: string, chunk = 500): Promise<number> {
    let written = 0;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
      const res = await fetch(`${this.base}/${table}${qs}`, {
        method: 'POST',
        headers: this.headers({
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
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

/** Batch rows into chunks. Exported because the chunk boundary is worth testing. */
export function chunk<T>(rows: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be positive');
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
