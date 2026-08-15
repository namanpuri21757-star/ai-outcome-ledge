import type { Company, Env, ObservationRow, RunError, RunResult } from './types';
import { Db, SubrequestBudget, SubrequestBudgetError } from './db';
import { SEC_TICKER_MAP_URL, companyFactsUrl, extractSeries, parseTickerMap, secFetch } from './sec';
import { StooqError, fetchPrices, probeStooq } from './stooq';
import {
  computeOutcome, computePriceOutcome, toRow, REASON_TEXT,
  type OutcomeReason, type Point,
} from './outcomes';

const OBS_CONFLICT = 'company_id,series_key,observed_at,source';
const OUTCOME_SERIES = ['operating_margin_q', 'price_close', 'opex_q', 'revenue_q'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Every run writes a row to fetch_runs, successful or not.
 *
 * Both writes go through `db.reserved()`, which is allowed to spend the
 * held-back subrequests. Without that, a job that ran out of requests
 * could not file the fact that it had run out — which is exactly how
 * every outcomes run in this table came to have a null `finished_at`
 * and an empty `errors` array.
 */
async function recordRun(db: Db, trigger: string, job: string, fn: () => Promise<RunResult>) {
  const book = db.reserved();
  const run = await book.insertReturning<{ id: number }>('fetch_runs', {
    trigger,
    job,
    started_at: new Date().toISOString(),
  });
  try {
    const result = await fn();
    await book.patch('fetch_runs', `id=eq.${run.id}`, {
      finished_at: new Date().toISOString(),
      ok: result.ok,
      companies_attempted: result.companiesAttempted,
      rows_written: result.rowsWritten,
      errors: result.errors,
      notes: result.notes ?? null,
    });
    return result;
  } catch (err: any) {
    await book.patch('fetch_runs', `id=eq.${run.id}`, {
      finished_at: new Date().toISOString(),
      ok: false,
      errors: [{ scope: 'run', message: String(err?.message ?? err) }],
      notes:
        err instanceof SubrequestBudgetError
          ? 'The job ran out of subrequests inside one invocation. Give it its own cron trigger, or reduce the number of round trips it makes.'
          : 'The job threw. The message is on the error.',
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Job 1: fundamentals from SEC XBRL
// ---------------------------------------------------------------------------
export async function runFundamentals(
  env: Env,
  budget: SubrequestBudget = new SubrequestBudget(),
): Promise<RunResult> {
  const db = new Db(env, budget);
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

  // Collected across every company and written once at the end.
  //
  // This was one upsert per company, which cost seventeen subrequests
  // where six will do — and the subrequest budget is the scarce thing in
  // a Worker invocation, not the payload size. `db.upsert` already
  // chunks at 500 rows, so batching here does not make any one request
  // larger than it was allowed to be.
  const pending: ObservationRow[] = [];

  for (const c of withCik) {
    try {
      const facts = await secFetch(companyFactsUrl(c.cik!), env.SEC_USER_AGENT);
      const series = extractSeries(facts);
      for (const s of series) {
        for (const p of s.points) {
          pending.push({
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
      if (!series.length) {
        errors.push({
          scope: c.slug,
          message:
            'Files with the SEC but reports no us-gaap concepts. Usually a foreign private issuer reporting under IFRS; no margin series is possible.',
          expected: true,
        });
      }
    } catch (err: any) {
      errors.push({ scope: c.slug, message: String(err?.message ?? err) });
    }
    await sleep(150); // comfortably inside the SEC's 10 requests per second
  }

  if (pending.length) rowsWritten = await db.upsert('observations', pending, OBS_CONFLICT);

  return {
    job: 'fundamentals',
    companiesAttempted: withCik.length,
    rowsWritten,
    errors,
    // A company that will never have us-gaap tags is not a failed run.
    // Counting it as one leaves the pipeline permanently red and trains
    // the reader to ignore the indicator.
    ok: errors.every((e) => e.expected),
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
export async function runPrices(
  env: Env,
  budget: SubrequestBudget = new SubrequestBudget(),
): Promise<RunResult> {
  const db = new Db(env, budget);
  const errors: RunError[] = [];
  let rowsWritten = 0;
  let attempted = 0;

  const companies = await db.select<Company>(
    'companies',
    'select=id,slug,stooq_symbol&stooq_symbol=not.is.null',
  );

  // A failure that is about Stooq rather than about a symbol is true for
  // every remaining company. Asking twenty more times cannot change the
  // answer, and listing it twenty times buries the one fact that matters,
  // so the loop stops and the run reports it once.
  let sourceLevel: StooqError | null = null;

  for (const c of companies) {
    attempted += 1;
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
      if (err instanceof StooqError && err.isSourceLevel) {
        sourceLevel = err;
        break;
      }
      errors.push({ scope: c.slug, message: String(err?.message ?? err) });
    }
    await sleep(400); // a free courtesy endpoint; do not hammer it
  }

  if (sourceLevel) {
    errors.push({
      scope: 'stooq',
      message:
        `${sourceLevel.message} Stopped after ${attempted} of ${companies.length} symbols; ` +
        'the remainder were not attempted because the result would be the same.',
    });
  }

  return {
    job: 'prices',
    companiesAttempted: attempted,
    rowsWritten,
    errors,
    ok: errors.length === 0,
    notes: sourceLevel
      ? `Stooq is not serving data (${sourceLevel.kind}). Price history is frozen at its last good run; ` +
        'margins come from SEC filings and are unaffected.'
      : `${attempted} symbols fetched from Stooq.`,
  };
}

// ---------------------------------------------------------------------------
// Job 3: derive claim outcomes
//
// Rewritten so that a run producing nothing explains itself. The old
// version pushed a row only when a baseline existed and returned no
// trace otherwise, which is how it came to report "0 rows, no errors"
// while every margin figure in the interface sat blank.
// ---------------------------------------------------------------------------
export async function runOutcomes(
  env: Env,
  budget: SubrequestBudget = new SubrequestBudget(),
): Promise<RunResult> {
  const db = new Db(env, budget);
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

  // One query per series for the whole table, grouped in memory.
  //
  // This was one query per company per series. With four series and
  // forty-five companies carrying published claims that is a hundred
  // and eighty sequential round trips in a single invocation, and the
  // job never survived them: every outcomes run in `fetch_runs` has a
  // null `finished_at`, an empty `errors` array and no notes, which is
  // what being killed mid-flight looks like — the isolate stops, so
  // neither the success patch nor the catch block ever runs. It reads
  // as "the job wrote no rows" on the health strip, which sent the
  // last two sessions looking for a data problem that was not there.
  //
  // Four queries, three pages each at most, and the grouping happens
  // here where it costs nothing.
  const seriesByCompany = new Map<string, Map<string, Point[]>>();

  for (const key of OUTCOME_SERIES) {
    try {
      const obs = await db.select<{ company_id: string; observed_at: string; value: string | number }>(
        'observations',
        // Ordered by company first so that pagination is stable and the
        // points arrive date-ascending within each company, which is
        // what computeOutcome expects.
        `select=company_id,observed_at,value&series_key=eq.${key}&order=company_id.asc,observed_at.asc`,
      );
      observationsRead += obs.length;

      for (const o of obs) {
        let forCompany = seriesByCompany.get(o.company_id);
        if (!forCompany) {
          forCompany = new Map<string, Point[]>();
          seriesByCompany.set(o.company_id, forCompany);
        }
        const points = forCompany.get(key);
        const point = { date: o.observed_at, value: Number(o.value) };
        if (points) points.push(point);
        else forCompany.set(key, [point]);
      }
    } catch (err: any) {
      // A failure in one series still must not cost the others.
      errors.push({ scope: key, message: String(err?.message ?? err) });
    }
  }

  for (const [companyId, list] of byCompany) {
    try {
      const bySeries = seriesByCompany.get(companyId) ?? new Map<string, Point[]>();

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

/**
 * Run a job, record it, and keep going if it throws.
 *
 * The jobs are independent: margins come from the SEC, prices come from
 * Stooq, and outcomes are derived from whatever observations exist. A
 * sequence that aborts on the first exception lets one unavailable source
 * suppress the two jobs behind it — which is how a Stooq outage could
 * take the margin figures down with it, even though the SEC was fine.
 * Partial and visible beats none and silent.
 */
async function runStep(
  db: Db,
  trigger: string,
  job: string,
  fn: (budget: SubrequestBudget) => Promise<RunResult>,
): Promise<RunResult> {
  try {
    return await recordRun(db, trigger, job, () => fn(db.budget));
  } catch (err: any) {
    return {
      job,
      companiesAttempted: 0,
      rowsWritten: 0,
      errors: [{ scope: job, message: String(err?.message ?? err) }],
      ok: false,
      notes: 'The job threw before it finished. The jobs after it still ran.',
    };
  }
}

/**
 * Prices are no longer collected on a schedule.
 *
 * Stooq began refusing automated clients in August 2026 and there is no
 * second source wired up yet, so a daily run would do nothing but ask a
 * closed door twenty times and file the same warning. The job itself is
 * kept, tested and reachable at `/run?job=prices`: the moment a source
 * is chosen it is one `fetchPrices` implementation away from working
 * again.
 *
 * Nothing is deleted. `price_close` stays in OUTCOME_SERIES, so the
 * observations already collected before the wall went up still produce
 * outcome rows, and "Share price, one year" still reads for the claims
 * that have it rather than being blanked for everyone.
 */
export const PRICES_ON_SCHEDULE = false;

/**
 * Which job each cron trigger runs.
 *
 * One job per trigger, and that is the whole point: a Worker's
 * subrequest budget is per invocation, so two jobs sharing one
 * invocation share one budget. Fundamentals and outcomes used to run
 * back to back on `15 6 * * *`; fundamentals finished, outcomes started
 * with what was left, and outcomes is the job that fills every margin
 * figure in the interface. Thirty minutes apart costs nothing and gives
 * each of them the whole ceiling.
 */
export const CRON_JOBS: Record<string, 'fundamentals' | 'prices' | 'outcomes'> = {
  '15 6 * * *': 'fundamentals',
  '45 6 * * *': 'outcomes',
};

export async function runAll(env: Env, trigger: string) {
  const results: RunResult[] = [];
  // A fresh budget per job, because `/run?job=all` is a convenience for
  // a human at a terminal rather than the scheduled path: each job is
  // still one invocation's worth of work, and making them share here
  // would reproduce the failure the cron split exists to remove.
  results.push(await runStep(new Db(env, new SubrequestBudget()), trigger, 'fundamentals',
    (b) => runFundamentals(env, b)));
  if (PRICES_ON_SCHEDULE) {
    results.push(await runStep(new Db(env, new SubrequestBudget()), trigger, 'prices',
      (b) => runPrices(env, b)));
  }
  results.push(await runStep(new Db(env, new SubrequestBudget()), trigger, 'outcomes',
    (b) => runOutcomes(env, b)));
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

    // One trigger, one job, one subrequest budget. `runStep` rather than
    // `recordRun` so a throw is still recorded rather than escaping.
    const job = CRON_JOBS[controller.cron];
    if (!job) return;
    if (job === 'prices' && !PRICES_ON_SCHEDULE) return;

    const db = new Db(env, new SubrequestBudget());
    const run =
      job === 'fundamentals' ? runFundamentals : job === 'prices' ? runPrices : runOutcomes;
    await runStep(db, controller.cron, job, (b) => run(env, b));
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

    // A live check of the one source that fails by returning HTTP 200.
    // Keyless and side-effect free, so it needs no token: it reads a
    // public price series and writes nothing.
    if (url.pathname === '/smoke') {
      const stooq = await probeStooq(url.searchParams.get('symbol') ?? undefined);
      return json({ ok: stooq.ok, stooq }, stooq.ok ? 200 : 503);
    }

    if (url.pathname === '/run') {
      if (!env.RUN_TOKEN || url.searchParams.get('token') !== env.RUN_TOKEN) {
        return json({ error: 'Bad or missing token.' }, 401);
      }
      const missing = missingConfig(env);
      if (missing.length) return json({ error: `Missing secrets: ${missing.join(', ')}` }, 500);

      const job = url.searchParams.get('job') ?? 'all';
      const db = new Db(env, new SubrequestBudget());
      try {
        if (job === 'fundamentals') return json(await recordRun(db, 'manual', job, () => runFundamentals(env, db.budget)));
        if (job === 'prices') return json(await recordRun(db, 'manual', job, () => runPrices(env, db.budget)));
        if (job === 'outcomes') return json(await recordRun(db, 'manual', job, () => runOutcomes(env, db.budget)));
        return json(await runAll(env, 'manual'));
      } catch (err: any) {
        return json({ error: String(err?.message ?? err) }, 500);
      }
    }

    return json({
      service: 'ai-outcome-ledger worker',
      endpoints: {
        '/health': 'config check, no secrets required',
        '/smoke?symbol=ibm.us': 'live check that Stooq still serves parseable CSV; 503 when it does not',
        '/run?job=all|fundamentals|prices|outcomes&token=RUN_TOKEN': 'trigger a job now',
      },
    });
  },
};
