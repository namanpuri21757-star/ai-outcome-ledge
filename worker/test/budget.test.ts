import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  Db,
  SubrequestBudget,
  SubrequestBudgetError,
  DEFAULT_SUBREQUEST_LIMIT,
  DEFAULT_RESERVE,
} from '../src/db';
import { runFundamentals, runOutcomes, CRON_JOBS, PRICES_ON_SCHEDULE } from '../src/index';
import type { Env } from '../src/types';
import { readFileSync } from 'node:fs';

/* ===================================================================
   A Worker invocation may make a limited number of outbound requests.
   Exceeding it does not raise something a job can catch: the isolate
   stops. That is what killed the outcomes job for its entire recorded
   history — one query per company per series, about 180 round trips —
   and the reason it left no trace is that the catch block's "record the
   failure" write is itself a request, so it died too.

   These tests hold the two halves of the fix: the budget stops a job
   before the ceiling, and the reserve is still there to file the report.
   =================================================================== */

const env: Env = {
  SUPABASE_URL: 'https://example.supabase.co/',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  SEC_USER_AGENT: 'Ledger test@example.com',
  RUN_TOKEN: 'tok',
};

afterEach(() => vi.unstubAllGlobals());

const okJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('SubrequestBudget', () => {
  it('holds back a reserve, so a job stops before the real ceiling', () => {
    const b = new SubrequestBudget(10, 3);
    for (let i = 0; i < 7; i++) b.take('observations');
    expect(b.remaining).toBe(0);
    expect(() => b.take('observations')).toThrow(SubrequestBudgetError);
  });

  it('lets a reserved caller spend the reserve it held back', () => {
    const b = new SubrequestBudget(10, 3);
    for (let i = 0; i < 7; i++) b.take('observations');
    expect(() => b.take('fetch_runs', true)).not.toThrow();
    expect(() => b.take('fetch_runs', true)).not.toThrow();
  });

  it('stops even a reserved caller at the hard ceiling', () => {
    const b = new SubrequestBudget(4, 2);
    for (let i = 0; i < 4; i++) b.take('fetch_runs', true);
    expect(() => b.take('fetch_runs', true)).toThrow(SubrequestBudgetError);
  });

  it('names the count it reached and the table it was reading', () => {
    const b = new SubrequestBudget(3, 1);
    b.take('observations');
    b.take('observations');
    try {
      b.take('observations');
      throw new Error('should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(SubrequestBudgetError);
      expect(err.message).toContain('2 of 3');
      expect(err.message).toContain('observations');
    }
  });

  it('defaults to the documented free-plan ceiling', () => {
    expect(DEFAULT_SUBREQUEST_LIMIT).toBe(50);
    expect(DEFAULT_RESERVE).toBeGreaterThanOrEqual(2);
    expect(new SubrequestBudget().remaining).toBe(50 - DEFAULT_RESERVE);
  });
});

describe('Db spends the budget it is given', () => {
  it('counts every select, upsert, insert and patch against one counter', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson([])));
    const budget = new SubrequestBudget(50, 4);
    const db = new Db(env, budget);

    await db.select('claims');
    await db.upsert('observations', [{ a: 1 }]);
    await db.insertReturning('fetch_runs', { a: 1 });
    await db.patch('fetch_runs', 'id=eq.1', { ok: true });

    expect(budget.spent).toBe(4);
  });

  it('shares one counter across every client built on the same budget', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson([])));
    const budget = new SubrequestBudget();
    const a = new Db(env, budget);
    const b = new Db(env, budget);
    await a.select('claims');
    await b.select('companies');
    expect(budget.spent).toBe(2);
  });

  it('refuses the request rather than making it, once the budget is gone', async () => {
    const fetchMock = vi.fn(async () => okJson([]));
    vi.stubGlobal('fetch', fetchMock);
    const db = new Db(env, new SubrequestBudget(3, 1));

    await db.select('claims');
    await db.select('claims');
    await expect(db.select('claims')).rejects.toThrow(SubrequestBudgetError);
    // Two made, the third never left the Worker.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('still lets the reserved client write after the job has been stopped', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson([])));
    const budget = new SubrequestBudget(4, 2);
    const db = new Db(env, budget);

    await db.select('claims');
    await db.select('claims');
    await expect(db.select('claims')).rejects.toThrow(SubrequestBudgetError);

    // This is the write that never happened in production.
    await expect(db.reserved().patch('fetch_runs', 'id=eq.1', { ok: false })).resolves.toBeUndefined();
  });
});

describe('the jobs fit inside one invocation', () => {
  /** A stub big enough to make the request count meaningful. */
  function stubForOutcomes(companies: number) {
    const claims = Array.from({ length: companies }, (_, i) => ({
      id: `claim-${i}`, company_id: `co-${i}`, claim_date: '2025-02-14',
    }));
    const quarters = ['2024-09-30', '2024-12-31', '2025-03-31', '2025-06-30', '2026-03-31'];
    const observations = claims.flatMap((c) =>
      quarters.map((q, qi) => ({ company_id: c.company_id, observed_at: q, value: 0.2 + qi * 0.01 })),
    );
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      const u = String(url);
      if (init?.method === 'POST' || init?.method === 'PATCH') return okJson([{ id: 1 }]);
      if (u.includes('/claims')) return okJson(claims);
      if (u.includes('series_key=eq.operating_margin_q')) return okJson(observations);
      return okJson([]);
    }));
  }

  it('runs outcomes for the whole corpus well inside the ceiling', async () => {
    stubForOutcomes(45);
    const budget = new SubrequestBudget();
    await runOutcomes(env, budget);
    // 1 claims read + 4 series reads + 1 upsert. The old shape wanted 180.
    expect(budget.spent).toBeLessThanOrEqual(10);
  });

  it('does not spend more as the corpus grows', async () => {
    stubForOutcomes(5);
    const small = new SubrequestBudget();
    await runOutcomes(env, small);
    vi.unstubAllGlobals();

    stubForOutcomes(60);
    const large = new SubrequestBudget();
    await runOutcomes(env, large);

    expect(large.spent).toBe(small.spent);
  });

  it('batches the fundamentals writes instead of one per company', async () => {
    const companies = Array.from({ length: 17 }, (_, i) => ({
      id: `co-${i}`, slug: `c${i}`, name: `C${i}`, ticker: `T${i}`, cik: `000000000${i}`,
      stooq_symbol: null, is_public: true,
    }));
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      const u = String(url);
      if (u.includes('data.sec.gov')) {
        return okJson({ facts: { 'us-gaap': {} } });
      }
      if (init?.method === 'POST' || init?.method === 'PATCH') return okJson([{ id: 1 }]);
      if (u.includes('/companies')) return okJson(companies);
      return okJson([]);
    }));

    const budget = new SubrequestBudget();
    await runFundamentals(env, budget);

    // One companies read. SEC fetches do not touch Db, so the only Db
    // spend left is the batched upsert — which is zero here because the
    // stubbed facts carry no us-gaap concepts.
    expect(budget.spent).toBeLessThanOrEqual(2);
  });
});

describe('cron triggers and jobs agree', () => {
  // Vitest runs with the package root as its cwd.
  const config = readFileSync('wrangler.jsonc', 'utf8');
  const crons: string[] = JSON.parse(config.replace(/^\s*\/\/.*$/gm, '')).triggers.crons;

  it('gives every configured trigger exactly one job', () => {
    for (const cron of crons) {
      expect(CRON_JOBS[cron], `no job mapped for cron "${cron}"`).toBeTruthy();
    }
  });

  it('gives every mapped job a trigger that actually fires', () => {
    for (const cron of Object.keys(CRON_JOBS)) {
      expect(crons, `CRON_JOBS names "${cron}" but wrangler.jsonc does not`).toContain(cron);
    }
  });

  it('never puts two jobs on one trigger, which is what broke outcomes', () => {
    expect(new Set(crons).size).toBe(crons.length);
    expect(Object.keys(CRON_JOBS)).toHaveLength(crons.length);
  });

  it('schedules fundamentals before outcomes, since outcomes reads what it wrote', () => {
    const minutes = (c: string) => {
      const [m, h] = c.split(' ');
      return Number(h) * 60 + Number(m);
    };
    const fundamentals = Object.entries(CRON_JOBS).find(([, j]) => j === 'fundamentals')![0];
    const outcomes = Object.entries(CRON_JOBS).find(([, j]) => j === 'outcomes')![0];
    expect(minutes(outcomes)).toBeGreaterThan(minutes(fundamentals));
  });

  it('keeps prices off the schedule while Stooq refuses automated clients', () => {
    expect(PRICES_ON_SCHEDULE).toBe(false);
    expect(Object.values(CRON_JOBS)).not.toContain('prices');
  });
});
