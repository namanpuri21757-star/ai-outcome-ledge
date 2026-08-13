import type { Company, Env, ObservationRow, RunError, RunResult } from './types';
import { Db } from './db';
import { SEC_TICKER_MAP_URL, companyFactsUrl, extractSeries, parseTickerMap, secFetch } from './sec';
import { fetchPrices } from './stooq';
import {
  computeOutcome, computePriceOutcome, toRow, REASON_TEXT,
  type OutcomeReason, type Point,
} from './outcomes';

const OBS_CONFLICT = 'company_id,series_key,observed_at,source';
const OUTCOME_SERIES = ['operating_margin_q', 'price_close', 'opex_q', 'revenue_q'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Every run writes a row to fetch_runs, successful or not. */
async function recordRun(db: Db, trigger: string, job: string, fn: () => Promise<RunResult>) {
  const run = await db.insertReturning<{ id: number }>('fetch_runs', {
    trigger,
    job,
    started_at: new Date().toISOString(),
  });
  try {
    const result = await fn();
    await db.patch('fetch_runs', `id=eq.${run.id}`, {
      finished_at: new Date().toISOString(),
      ok: result.ok,
      companies_attempted: result.companiesAttempted,
      rows_written: result.rowsWritten,
      errors: result.errors,
      notes: result.notes ?? null,
    });
    return result;
  } catch (err: any) {
    await db.patch('fetch_runs', `id=eq.${run.id}`, {
      finished_at: new Date().toISOString(),
      ok: false,
      errors: [{ scope: 'run', message: String(err?.message ?? err) }],
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Job 1: fundamentals from SEC XBRL
// ---------------------------------------------------------------------------
export async function runFundamentals(env: Env): Promise<RunResult> {
  const db = new Db(env);
  const errors: RunError[] = [];
  let rowsWritten = 0;

  const companies = await db.select<Company>(
    'companies',
    'select=id,slug,name,ticker,cik,stooq_symbol,is_public&is_public=eq.true',
  );

  const needCik = companies.filter((c) => !c.cik && c.ticker);
  if (needCik.length) {
    try {
      const map = parseTickerMap(await secFetch(SEC_TICKER_MAP_URL, env.SEC_USER_AGENT));
      for (const c of needCik) {
        const cik = map.get(c.ticker!.toUpperCase());
        if (cik) {
          await db.patch('companies', `id=eq.${c.id}`, { cik });
          c.cik = cik;
        }
        // A non-US listing has no CIK and never will. That is a known
        // fact about the company, not a fault in the run, so it is not
        // reported as a warning — it was three of these repeating every
        // run that made a healthy pipeline look broken.
      }
    } catch (err: any) {
      errors.push({ scope: 'cik-map', message: String(err?.message ?? err) });
    }
  }

  const withCik = companies.filter((c) => c.cik);
  const noCik = companies.filter((c) => !c.cik);

  for (const c of withCik) {
    try {
      const facts = await secFetch(companyFactsUrl(c.cik!), env.SEC_USER_AGENT);
      const series = extractSeries(facts);
      const rows: ObservationRow[] = [];
      for (const s of series) {
        for (const p of s.points) {
          rows.push({
            company_id: c.id,
            series_key: s.key,
            observed_at: p.end,
            value: p.value,
            unit: s.unit,
            fiscal_period: p.fiscalPeriod,
            source: 'sec_xbrl',
            source_ref: p.ref ?? s.sourceTag ?? null,
          });
        }
      }
      if (rows.length) rowsWritten += await db.upsert('observations', rows, OBS_CONFLICT);
      if (!series.length) {
        errors.push({
          scope: c.slug,
          message:
            'Files with the SEC but reports no us-gaap concepts. Usually a foreign private issuer reporting under IFRS; no margin series is possible.',
        });
      }
    } catch (err: any) {
      errors.push({ scope: c.slug, message: String(err?.message ?? err) });
    }
    await sleep(150); // comfortably inside the SEC's 10 requests per second
  }

  return {
    job: 'fundamentals',
    companiesAttempted: withCik.length,
    rowsWritten,
    errors,
    ok: errors.length === 0,
    notes:
      `${withCik.length} SEC filers processed. ` +
      (noCik.length
        ? `${noCik.length} listed outside the SEC (${noCik.map((c) => c.slug).join(', ')}); no fundamentals are expected for them.`
        : ''),
  };
}

// ---------------------------------------------------------------------------
// Job 2: daily closes from Stooq
// ---------------------------------------------------------------------------
export async function runPrices(env: Env): Promise<RunResult> {
  const db = new Db(env);
  const errors: RunError[] = [];
  let rowsWritten = 0;

  const companies = await db.select<Company>(
    'companies',
    'select=id,slug,stooq_symbol&stooq_symbol=not.is.null',
  );

  for (const c of companies) {
    try {
      const prices = await fetchPrices(c.stooq_symbol!);
      const rows: ObservationRow[] = prices.map((p) => ({
        company_id: c.id,
        series_key: 'price_close',
        observed_at: p.date,
        value: p.close,
        unit: 'usd',
        source: 'stooq',
        source_ref: c.stooq_symbol,
      }));
      rowsWritten += await db.upsert('observations', rows, OBS_CONFLICT);
    } catch (err: any) {
      errors.push({ scope: c.slug, message: String(err?.message ?? err) });
    }
    await sleep(400); // a free courtesy endpoint; do not hammer it
  }

  return { job: 'prices', companiesAttempted: companies.length, rowsWritten, errors, ok: errors.length === 0 };
}

// ---------------------------------------------------------------------------
// Job 3: derive claim outcomes
//
// Rewritten so that a run producing nothing explains itself. The old
// version pushed a row only when a baseline existed and returned no
// trace otherwise, which is how it came to report "0 rows, no errors"
// while every margin figure in the interface sat blank.
// ---------------------------------------------------------------------------
export async function runOutcomes(env: Env): Promise<RunResult> {
  const db = new Db(env);
  const errors: RunError[] = [];
  const tally: Record<string, number> = {};
  const count = (r: OutcomeReason) => { tally[r] = (tally[r] ?? 0) + 1; };

  const claims = await db.select<{ id: string; company_id: string; claim_date: string }>(
    'claims',
    'select=id,company_id,claim_date&status=eq.published',
  );

  const byCompany = new Map<string, typeof claims>();
  for (const c of claims) {
    const list = byCompany.get(c.company_id) ?? [];
    list.push(c);
    byCompany.set(c.company_id, list);
  }

  const rows: Array<Record<string, unknown>> = [];
  let companiesWithSeries = 0;
  let observationsRead = 0;

  for (const [companyId, list] of byCompany) {
    try {
      // One query per series rather than one filtered by `in`. Each
      // comes back small enough to be obviously complete, and a failure
      // in one series no longer costs the others.
      const bySeries = new Map<string, Point[]>();
      for (const key of OUTCOME_SERIES) {
        const obs = await db.select<{ observed_at: string; value: string | number }>(
          'observations',
          `select=observed_at,value&company_id=eq.${companyId}&series_key=eq.${key}&order=observed_at.asc`,
        );
        observationsRead += obs.length;
        if (obs.length) {
          bySeries.set(key, obs.map((o) => ({ date: o.observed_at, value: Number(o.value) })));
        }
      }

      if (bySeries.size === 0) {
        for (const _ of list) count('no_series');
        continue;
      }
      companiesWithSeries += 1;

      for (const claim of list) {
        let wroteAny = false;
        for (const [seriesKey, points] of bySeries) {
          const outcome =
            seriesKey === 'price_close'
              ? computePriceOutcome(points, claim.claim_date)
              : computeOutcome(points, claim.claim_date, { asBps: seriesKey.endsWith('margin_q') });

          if (outcome.baseline_at === null) continue;
          rows.push(toRow(claim.id, seriesKey, outcome));
          wroteAny = true;
          if (seriesKey === 'operating_margin_q') count(outcome.reason);
        }
        if (!wroteAny) count('no_baseline_before_claim');
      }
    } catch (err: any) {
      errors.push({ scope: companyId, message: String(err?.message ?? err) });
    }
  }

  let rowsWritten = 0;
  if (rows.length) rowsWritten = await db.upsert('claim_outcomes', rows, 'claim_id,series_key');

  // The summary is the point. A run that writes nothing now says which
  // branch it took and how often, so the next question is answerable
  // without adding logging first.
  const breakdown = Object.entries(tally)
    .map(([reason, n]) => `${n} ${REASON_TEXT[reason as OutcomeReason] ?? reason}`)
    .join('; ');

  const notes =
    `${claims.length} published claims across ${byCompany.size} companies. ` +
    `${companiesWithSeries} companies had an observation series; ${observationsRead.toLocaleString()} observations read. ` +
    `Margin outcomes: ${breakdown || 'none attempted'}.`;

  if (rowsWritten === 0) {
    errors.push({
      scope: 'outcomes',
      message:
        observationsRead === 0
          ? 'No observations were read at all. Run the fundamentals job first; until it succeeds there is nothing to measure claims against.'
          : `Observations exist (${observationsRead.toLocaleString()} read) but no claim could be matched to one. ${notes}`,
    });
  }

  return {
    job: 'outcomes',
    companiesAttempted: byCompany.size,
    rowsWritten,
    errors,
    ok: errors.length === 0 && rowsWritten > 0,
    notes,
  };
}

export async function runAll(env: Env, trigger: string) {
  const db = new Db(env);
  const results: RunResult[] = [];
  results.push(await recordRun(db, trigger, 'fundamentals', () => runFundamentals(env)));
  results.push(await recordRun(db, trigger, 'prices', () => runPrices(env)));
  results.push(await recordRun(db, trigger, 'outcomes', () => runOutcomes(env)));
  return results;
}

function missingConfig(env: Env): string[] {
  return (['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SEC_USER_AGENT', 'RUN_TOKEN'] as const).filter(
    (k) => !env[k],
  );
}

export default {
  async scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const missing = missingConfig(env);
    if (missing.length) throw new Error(`Worker is missing secrets: ${missing.join(', ')}`);

    const db = new Db(env);
    if (controller.cron === '30 22 * * 1-5') {
      await recordRun(db, controller.cron, 'prices', () => runPrices(env));
      await recordRun(db, controller.cron, 'outcomes', () => runOutcomes(env));
    } else {
      await recordRun(db, controller.cron, 'fundamentals', () => runFundamentals(env));
      await recordRun(db, controller.cron, 'outcomes', () => runOutcomes(env));
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body, null, 2), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });

    if (url.pathname === '/health') {
      return json({ ok: missingConfig(env).length === 0, missing: missingConfig(env) });
    }

    if (url.pathname === '/run') {
      if (!env.RUN_TOKEN || url.searchParams.get('token') !== env.RUN_TOKEN) {
        return json({ error: 'Bad or missing token.' }, 401);
      }
      const missing = missingConfig(env);
      if (missing.length) return json({ error: `Missing secrets: ${missing.join(', ')}` }, 500);

      const job = url.searchParams.get('job') ?? 'all';
      const db = new Db(env);
      try {
        if (job === 'fundamentals') return json(await recordRun(db, 'manual', job, () => runFundamentals(env)));
        if (job === 'prices') return json(await recordRun(db, 'manual', job, () => runPrices(env)));
        if (job === 'outcomes') return json(await recordRun(db, 'manual', job, () => runOutcomes(env)));
        return json(await runAll(env, 'manual'));
      } catch (err: any) {
        return json({ error: String(err?.message ?? err) }, 500);
      }
    }

    return json({
      service: 'ai-outcome-ledger worker',
      endpoints: {
        '/health': 'config check, no secrets required',
        '/run?job=all|fundamentals|prices|outcomes&token=RUN_TOKEN': 'trigger a job now',
      },
    });
  },
};
