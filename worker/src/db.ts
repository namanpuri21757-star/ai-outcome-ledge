import type { Env } from './types';

/**
 * A deliberately tiny PostgREST client.
 *
 * ── Two things this file exists to prevent ─────────────────────────
 *
 * **1. Silent truncation.** `select` paginates. PostgREST applies a
 * server-side row cap and answers a request that exceeds it with HTTP
 * 200 and a truncated body — no error, no warning, the caller simply
 * receives fewer rows than exist and has no way to tell. Paginating with
 * an explicit Range header removes the failure mode, and
 * `lastPageWasFull` lets a caller assert that it saw everything rather
 * than assuming it.
 *
 * **2. Running out of subrequests without leaving a trace.** A Worker
 * invocation may make a limited number of outbound requests. Exceeding
 * it does not return an error a job can catch and report: the isolate
 * stops. That is what killed the outcomes job for its entire history —
 * it issued one query per company per series, about 180 sequential round
 * trips, and every outcomes row in `fetch_runs` has a null `finished_at`
 * as a result. The reason it left no trace is the cruel part: the catch
 * block's "record the failure" PATCH is itself a subrequest, so it dies
 * too, and the run looks like it simply wrote nothing.
 *
 * `SubrequestBudget` counts every request and stops the job *before* the
 * ceiling, holding back a small reserve that only the run-recording
 * writes may spend. A job that asks for too much now fails loudly, with
 * the number it reached, instead of vanishing.
 */

const PAGE = 1000;

/**
 * The per-invocation subrequest ceiling. 50 is the documented Workers
 * free-plan limit and the number every observed failure in `fetch_runs`
 * is consistent with: fundamentals costs about 26 requests and finished;
 * prices costs about 21 and finished alone but died when it followed
 * fundamentals in the same invocation; the old outcomes job wanted 180
 * and never finished from any starting point.
 */
export const DEFAULT_SUBREQUEST_LIMIT = 50;

/** Held back so that recording the failure is always affordable. */
export const DEFAULT_RESERVE = 4;

export class SubrequestBudgetError extends Error {
  constructor(readonly spent: number, readonly limit: number, readonly table: string) {
    super(
      `Subrequest budget exhausted at ${spent} of ${limit} while reading ${table}. ` +
        'The job asked for more round trips than one Worker invocation allows. ' +
        'Split it across invocations or collapse the queries; do not raise this number blindly.',
    );
    this.name = 'SubrequestBudgetError';
  }
}

/**
 * One counter shared by every `Db` in a single invocation.
 *
 * Jobs construct their own `Db`, so a counter that lived on the client
 * would reset between them and measure nothing. The budget is passed in
 * instead, which is also what makes it testable: a test can hand a job a
 * budget of four and watch it stop.
 */
export class SubrequestBudget {
  spent = 0;

  constructor(
    readonly limit: number = DEFAULT_SUBREQUEST_LIMIT,
    readonly reserve: number = DEFAULT_RESERVE,
  ) {}

  /** Requests a job may still make before the reserve is reached. */
  get remaining(): number {
    return Math.max(0, this.limit - this.reserve - this.spent);
  }

  /**
   * Claim one request. `reserved` callers may spend into the reserve —
   * that is only the bookkeeping writes in `recordRun`, which must be
   * able to file the failure that the exhaustion caused.
   */
  take(table: string, reserved = false): void {
    const ceiling = reserved ? this.limit : this.limit - this.reserve;
    if (this.spent >= ceiling) throw new SubrequestBudgetError(this.spent, this.limit, table);
    this.spent += 1;
  }
}

export class Db {
  /** Set after each select: true when the final page came back full,
   *  which means the server may still be holding rows back. */
  lastPageWasFull = false;

  readonly budget: SubrequestBudget;

  constructor(
    private env: Env,
    budget: SubrequestBudget = new SubrequestBudget(),
    private privileged = false,
  ) {
    this.budget = budget;
  }

  /**
   * A second client on the same budget, allowed into the reserve.
   * Used only for writing to `fetch_runs`: a run that could not be
   * recorded is a run nobody can diagnose.
   */
  reserved(): Db {
    return new Db(this.env, this.budget, true);
  }

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

  /** Every outbound request in this file goes through here, so the
   *  budget cannot be bypassed by adding a method. */
  private async request(table: string, url: string, init: RequestInit): Promise<Response> {
    this.budget.take(table, this.privileged);
    return fetch(url, init);
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

      const res = await this.request(table, url, {
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
      const res = await this.request(table, `${this.base}/${table}${qs}`, {
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
    const res = await this.request(table, `${this.base}/${table}`, {
      method: 'POST',
      headers: this.headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`insert ${table} failed ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as T[];
    return body[0];
  }

  async patch(table: string, query: string, patch: any): Promise<void> {
    const res = await this.request(table, `${this.base}/${table}?${query}`, {
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
