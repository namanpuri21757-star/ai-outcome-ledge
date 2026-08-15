import { afterEach, describe, expect, it, vi } from 'vitest';
import { runPrices } from '../src/index';
import type { Env } from '../src/types';

/**
 * The reporting defect, tested directly.
 *
 * One change of policy at Stooq was reported as twenty independent
 * per-company faults, each blaming a ticker symbol that was correct. The
 * run now stops at the first source-level refusal and states it once.
 */

const CHALLENGE =
  '<!DOCTYPE html><html><body><noscript>This site requires JavaScript to verify your browser.' +
  '</noscript><script>fetch("/__verify")</script></body></html>';

const CSV = `Date,Open,High,Low,Close,Volume
2025-01-02,100.0,101.5,99.5,101.0,1000
2025-01-03,101.0,102.0,100.5,100.25,1200`;

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  SEC_USER_AGENT: 'test test@example.com',
  RUN_TOKEN: 'token',
} as Env;

const companies = ['ibm', 'msft', 'amzn', 'jpm', 'vz'].map((slug, i) => ({
  id: `id-${i}`,
  slug,
  stooq_symbol: `${slug}.us`,
}));

/**
 * Stand in for Supabase and Stooq together. `stooqBody` decides what the
 * price source returns; everything addressed to Supabase is answered
 * with the company list or an empty success.
 */
function stubFetch(stooqBody: (symbol: string) => { body: string; status?: number }) {
  const stooqCalls: string[] = [];

  vi.stubGlobal('fetch', async (input: any, init?: any) => {
    const url = String(input);

    if (url.includes('stooq.com')) {
      const symbol = new URL(url).searchParams.get('s') ?? '';
      stooqCalls.push(symbol);
      const { body, status = 200 } = stooqBody(symbol);
      return new Response(body, { status });
    }

    if (url.includes('/rest/v1/companies')) {
      return new Response(JSON.stringify(companies), { status: 200 });
    }
    // observations upsert
    if (init?.method === 'POST') return new Response('', { status: 201 });
    return new Response('[]', { status: 200 });
  });

  return stooqCalls;
}

describe('runPrices against a source-level refusal', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stops at the first challenge instead of asking every symbol', async () => {
    const calls = stubFetch(() => ({ body: CHALLENGE }));
    const result = await runPrices(env);

    expect(calls).toHaveLength(1);
    expect(result.companiesAttempted).toBe(1);
  });

  it('reports one problem, not one per company', async () => {
    stubFetch(() => ({ body: CHALLENGE }));
    const result = await runPrices(env);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].scope).toBe('stooq');
    expect(result.ok).toBe(false);
  });

  it('names the browser wall and clears the ticker symbols', async () => {
    stubFetch(() => ({ body: CHALLENGE }));
    const [error] = (await runPrices(env)).errors;

    expect(error.message).toMatch(/browser-verification/);
    expect(error.message).not.toMatch(/symbol is probably wrong/);
    expect(error.message).toMatch(/Stopped after 1 of 5 symbols/);
  });

  it('says margins are unaffected, because they come from the SEC', async () => {
    stubFetch(() => ({ body: CHALLENGE }));
    const result = await runPrices(env);
    expect(result.notes).toMatch(/margins come from SEC filings and are unaffected/);
  });

  it('treats the daily hit limit the same way', async () => {
    const calls = stubFetch(() => ({ body: 'Exceeded the daily hits limit' }));
    const result = await runPrices(env);

    expect(calls).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].scope).toBe('stooq');
  });
});

describe('runPrices against a single bad symbol', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps going, because one wrong symbol says nothing about the rest', async () => {
    const calls = stubFetch((symbol) =>
      symbol === 'amzn.us' ? { body: '<html><body>404</body></html>' } : { body: CSV },
    );
    const result = await runPrices(env);

    expect(calls).toHaveLength(5);
    expect(result.companiesAttempted).toBe(5);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].scope).toBe('amzn');
  });

  it('is healthy and quiet when every symbol works', async () => {
    const result = await (async () => {
      stubFetch(() => ({ body: CSV }));
      return runPrices(env);
    })();

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBeGreaterThan(0);
    expect(result.notes).toMatch(/5 symbols fetched/);
  });
});
