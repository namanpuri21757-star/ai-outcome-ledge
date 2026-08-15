import { describe, expect, it, vi, afterEach } from 'vitest';
import { runOutcomes } from '../src/index';
import type { Env } from '../src/types';

/* ===================================================================
   The outcomes job used to issue one request per company per series.

   That is not a style question. Every outcomes run recorded in
   `fetch_runs` had a null `finished_at`, an empty `errors` array and no
   notes — the shape of an invocation killed part-way through, where
   neither the success patch nor the catch block gets to run. On the
   health strip it read as "the outcomes job wrote no rows", which is
   true and points at entirely the wrong thing: the job was not finding
   nothing, it was not finishing.

   So the count of requests is the behaviour under test, and it has to
   stay flat as companies are added. Asserting only on the rows written
   would pass just as happily with the loop the wrong way round.
   =================================================================== */

const env: Env = {
  SUPABASE_URL: 'https://example.supabase.co/',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  SEC_USER_AGENT: 'Ledger test@example.com',
  RUN_TOKEN: 'tok',
};

/** Quarter ends either side of a claim, so every claim has a baseline. */
const QUARTERS = ['2024-12-31', '2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31', '2026-03-31'];

function stubSupabase(companyCount: number) {
  const calls: string[] = [];

  const claims = Array.from({ length: companyCount }, (_, i) => ({
    id: `claim-${i}`,
    company_id: `co-${i}`,
    claim_date: '2025-02-14',
  }));

  const observations = claims.flatMap((c) =>
    QUARTERS.map((q, qi) => ({
      company_id: c.company_id,
      observed_at: q,
      value: 0.21 - qi * 0.001,
    })),
  );

  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const u = String(url);
    calls.push(u);

    if (init?.method === 'POST') {
      return new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
    }
    if (u.includes('/claims')) {
      return new Response(JSON.stringify(claims), { status: 200 });
    }
    if (u.includes('/observations')) {
      // Only the operating-margin series carries anything, which is the
      // real shape: prices stopped and the other two are not collected.
      const body = u.includes('series_key=eq.operating_margin_q') ? observations : [];
      return new Response(JSON.stringify(body), { status: 200 });
    }
    return new Response('[]', { status: 200 });
  }));

  return { calls, claims, observations };
}

afterEach(() => vi.unstubAllGlobals());

describe('runOutcomes request count', () => {
  it('does not grow the number of reads as companies are added', async () => {
    const small = stubSupabase(3);
    await runOutcomes(env);
    const readsForThree = small.calls.filter((u) => u.includes('/observations')).length;
    vi.unstubAllGlobals();

    const large = stubSupabase(45);
    await runOutcomes(env);
    const readsForFortyFive = large.calls.filter((u) => u.includes('/observations')).length;

    expect(readsForFortyFive).toBe(readsForThree);
  });

  it('reads each series once rather than once per company', async () => {
    const { calls } = stubSupabase(45);
    await runOutcomes(env);

    const reads = calls.filter((u) => u.includes('/observations'));
    // Four series, one page each at this size. The old shape issued
    // 45 × 4 = 180 and never returned.
    expect(reads.length).toBe(4);
    expect(reads.some((u) => u.includes('company_id=eq.'))).toBe(false);
  });

  it('orders by company so pagination is stable across pages', async () => {
    const { calls } = stubSupabase(5);
    await runOutcomes(env);

    const read = calls.find((u) => u.includes('/observations'))!;
    expect(decodeURIComponent(read)).toContain('order=company_id.asc,observed_at.asc');
  });
});

describe('runOutcomes still produces the outcomes', () => {
  it('finishes, and says what it did', async () => {
    const { calls } = stubSupabase(45);
    const result = await runOutcomes(env);

    // The thing that never happened in production: returning at all.
    expect(result.job).toBe('outcomes');
    expect(result.notes).toBeTruthy();
    expect(result.notes).toContain('45 published claims');
    expect(calls.some((u) => u.includes('/claim_outcomes'))).toBe(true);
  });

  it('writes a row for every company that has a series', async () => {
    stubSupabase(45);
    const result = await runOutcomes(env);
    expect(result.rowsWritten).toBeGreaterThan(0);
    expect(result.companiesAttempted).toBe(45);
  });

  it('groups each company onto its own points rather than pooling them', async () => {
    // If the grouping were wrong, every company would share one series
    // and the count of written rows would not track the company count.
    stubSupabase(4);
    const four = await runOutcomes(env);
    vi.unstubAllGlobals();

    stubSupabase(8);
    const eight = await runOutcomes(env);

    expect(eight.rowsWritten).toBe(four.rowsWritten * 2);
  });

  it('reports a series that fails without losing the others', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      const u = String(url);
      if (init?.method === 'POST') return new Response('[]', { status: 201 });
      if (u.includes('/claims')) {
        return new Response(JSON.stringify([
          { id: 'c1', company_id: 'co-1', claim_date: '2025-02-14' },
        ]), { status: 200 });
      }
      if (u.includes('series_key=eq.operating_margin_q')) {
        return new Response('boom', { status: 500 });
      }
      return new Response('[]', { status: 200 });
    }));

    const result = await runOutcomes(env);
    expect(result.errors.some((e) => e.scope === 'operating_margin_q')).toBe(true);
    // Still returned, still explained itself.
    expect(result.notes).toBeTruthy();
  });
});
