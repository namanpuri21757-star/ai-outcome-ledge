import type { Company, Env, ObservationRow, RunError, RunResult } from './types';
import { Db } from './db';
import { SEC_TICKER_MAP_URL, companyFactsUrl, extractSeries, parseTickerMap, secFetch } from './sec';
import { fetchPrices } from './stooq';
import { computeOutcome, computePriceOutcome, type Point } from './outcomes';

const OBS_CONFLICT = 'company_id,series_key,observed_at,source';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Every run writes a row to fetch_runs, successful or not. A pipeline that
 *  fails silently is worse than one that fails loudly, because you keep
 *  reading a chart that stopped updating three weeks ago. */
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

  // Resolve any missing CIKs once, from the SEC's own mapping file.
  const needCik = companies.filter((c) => !c.cik && c.ticker);
  if (needCik.length) {
    try {
      const map = parseTickerMap(await secFetch(SEC_TICKER_MAP_URL, env.SEC_USER_AGENT));
      for (const c of needCik) {
        const cik = map.get(c.ticker!.toUpperCase());
        if (cik) {
          await db.patch('companies', `id=eq.${c.id}`, { cik });
          c.cik = cik;
        } else {
          errors.push({
            scope: c.slug,
            message: `Ticker ${c.ticker} is not in the SEC mapping file. Probably a non-US listing; fundamentals will be skipped.`,
          });
        }
      }
    } catch (err: any) {
      errors.push({ scope: 'cik-map', message: String(err?.message ?? err) });
    }
  }

  const withCik = companies.filter((c) => c.cik);

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
        errors.push({ scope: c.slug, message: 'No usable us-gaap concepts found in companyfacts.' });
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
    notes: `${withCik.length} filers with a CIK; ${companies.length - withCik.length} public companies skipped for lack of one.`,
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
    await sleep(400); // Stooq is a free courtesy endpoint; do not hammer it
  }

  return {
    job: 'prices',
    companiesAttempted: companies.length,
    rowsWritten,
    errors,
    ok: errors.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Job 3: derive claim outcomes from whatever observations now exist
// ---------------------------------------------------------------------------
export async function runOutcomes(env: Env): Promise<RunResult> {
  const db = new Db(env);
  const errors: RunError[] = [];

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

  const rows: any[] = [];

  for (const [companyId, list] of byCompany) {
    try {
      const obs = await db.select<{ series_key: string; observed_at: string; value: string }>(
        'observations',
        `select=series_key,observed_at,value&company_id=eq.${companyId}&series_key=in.(operating_margin_q,price_close,opex_q,revenue_q)&order=observed_at.asc`,
      );
      if (!obs.length) continue;

      const bySeries = new Map<string, Point[]>();
      for (const o of obs) {
        const list2 = bySeries.get(o.series_key) ?? [];
        list2.push({ date: o.observed_at, value: Number(o.value) });
        bySeries.set(o.series_key, list2);
      }

      for (const claim of list) {
        for (const [seriesKey, points] of bySeries) {
          const outcome =
            seriesKey === 'price_close'
              ? computePriceOutcome(points, claim.claim_date)
              : computeOutcome(points, claim.claim_date, { asBps: seriesKey.endsWith('margin_q') });
          if (outcome.baseline_at === null) continue;
          rows.push({ claim_id: claim.id, series_key: seriesKey, ...outcome, computed_at: new Date().toISOString() });
        }
      }
    } catch (err: any) {
      errors.push({ scope: companyId, message: String(err?.message ?? err) });
    }
  }

  let rowsWritten = 0;
  if (rows.length) rowsWritten = await db.upsert('claim_outcomes', rows, 'claim_id,series_key');

  return {
    job: 'outcomes',
    companiesAttempted: byCompany.size,
    rowsWritten,
    errors,
    ok: errors.length === 0,
    notes: `${claims.length} published claims examined.`,
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
  /**
   * Two schedules. Prices daily after the US close; fundamentals and derived
   * outcomes once a day an hour later, so outcomes always run against fresh
   * observations rather than yesterday's.
   */
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
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
