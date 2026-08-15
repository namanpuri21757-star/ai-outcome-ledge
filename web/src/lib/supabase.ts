import { createClient } from '@supabase/supabase-js';
import type { CompanyRef, Dataset, FetchRun, LedgerRow, Observation } from './types';
import { MARGIN_SERIES, REVENUE_SERIES } from './outcome';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configError =
  !url || !key
    ? 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild. Both are baked into the bundle at build time, so saving them is not enough.'
    : null;

export const supabase = createClient(url ?? 'https://placeholder.supabase.co', key ?? 'placeholder', {
  auth: { persistSession: false },
});

/* ===================================================================
   Reading everything, and knowing that you did.

   PostgREST caps a response at a configured number of rows and answers
   an over-cap request with HTTP 200 and a truncated body. There is no
   error and no flag: the caller simply gets fewer rows than exist. The
   previous build had one query with `.limit(2000)` and one with no bound
   at all, and neither could tell a complete answer from a clipped one.

   `fetchAll` pages with an explicit range until a page comes back short,
   which is the only way to know the end was reached. `PAGE` is
   deliberately below any plausible server cap so the short-page signal
   is real rather than an artefact of asking for exactly the cap.
   =================================================================== */

export const PAGE = 500;
export const MAX_PAGES = 60;

export class TruncatedError extends Error {
  constructor(table: string, got: number) {
    super(
      `Reading ${table} stopped after ${got} rows at the page guard. The table is larger than this page expects, so the figures on screen would be computed from part of it.`,
    );
    this.name = 'TruncatedError';
  }
}

/**
 * The only thing `fetchAll` needs from a query builder. Typed
 * structurally rather than with PostgrestFilterBuilder's generics, so a
 * test can hand it a plain object and so the signature stays readable.
 */
export interface Rangeable<T> {
  range(
    from: number,
    to: number,
  ): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}

/**
 * @param build called once per page; must return a fresh query.
 */
export async function fetchAll<T>(
  table: string,
  build: () => Rangeable<T>,
  page = PAGE,
  maxPages = MAX_PAGES,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const from = i * page;
    const { data, error } = await build().range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < page) return out;
  }
  // Never return a silently partial answer.
  throw new TruncatedError(table, out.length);
}

/* ------------------------------------------------------------------ */

/** The two series the interface reads. Anything else is collected but unused. */
export const SERIES_IN_USE = [MARGIN_SERIES, REVENUE_SERIES];

export async function loadDataset(): Promise<Dataset> {
  const [rows, companies, observations] = await Promise.all([
    fetchAll<LedgerRow>('v_ledger', () =>
      supabase
        .from('v_ledger')
        .select('*')
        .order('claim_date', { ascending: false }) as unknown as Rangeable<LedgerRow>,
    ),
    fetchAll<CompanyRef>('companies', () =>
      supabase
        .from('companies')
        .select('id,slug,cik,is_public')
        .order('slug') as unknown as Rangeable<CompanyRef>,
    ),
    fetchAll<Observation>('observations', () =>
      supabase
        .from('observations')
        .select('company_id,series_key,observed_at,value')
        .in('series_key', SERIES_IN_USE)
        .order('company_id')
        .order('observed_at') as unknown as Rangeable<Observation>,
    ),
  ]);

  return { rows, companies, series: indexSeries(companies, observations) };
}

/**
 * Observations arrive keyed by company id; everything on screen is keyed
 * by slug. Joining once here means no view has to carry the id around.
 */
export function indexSeries(
  companies: CompanyRef[],
  observations: Observation[],
): Dataset['series'] {
  const slugById = new Map(companies.map((c) => [c.id, c.slug]));
  const out: Dataset['series'] = new Map();

  for (const o of observations) {
    const slug = slugById.get(o.company_id);
    if (!slug) continue;
    let forCompany = out.get(slug);
    if (!forCompany) {
      forCompany = new Map();
      out.set(slug, forCompany);
    }
    const points = forCompany.get(o.series_key);
    const point = { date: o.observed_at, value: Number(o.value) };
    if (points) points.push(point);
    else forCompany.set(o.series_key, [point]);
  }

  for (const forCompany of out.values()) {
    for (const points of forCompany.values()) {
      points.sort((a, b) => a.date.localeCompare(b.date));
    }
  }
  return out;
}

/** The collector's own record. Read only by the maintenance page. */
export async function loadRuns(): Promise<FetchRun[]> {
  const { data, error } = await supabase
    .from('fetch_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as FetchRun[];
}

export function friendlyError(message: string): string {
  if (message.includes('does not exist')) {
    return 'The database views are missing. Run the SQL files in supabase/ in order, in the Supabase SQL editor.';
  }
  if (/failed to fetch|networkerror/i.test(message)) {
    return 'The database did not answer. Check the project URL in the build, and whether the Supabase project is paused.';
  }
  return message;
}
