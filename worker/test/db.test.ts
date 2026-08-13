import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Db, chunk } from '../src/db';
import type { Env } from '../src/types';

const env: Env = {
  SUPABASE_URL: 'https://example.supabase.co/',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  SEC_USER_AGENT: 'Ledger test@example.com',
  RUN_TOKEN: 'tok',
};

describe('chunk', () => {
  it('splits evenly and keeps the remainder', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('returns nothing for an empty list', () => {
    expect(chunk([], 10)).toEqual([]);
  });
  it('rejects a non-positive size instead of looping forever', () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe('Db.select pagination', () => {
  let calls: Array<{ url: string; init: any }>;

  const stub = (pages: any[][]) => {
    calls = [];
    let i = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push({ url: String(url), init });
      const body = pages[i++] ?? [];
      return new Response(JSON.stringify(body), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }));
  };

  afterEach(() => vi.unstubAllGlobals());

  it('sends an explicit Range header so the server cannot silently truncate', async () => {
    stub([[]]);
    await new Db(env).select('observations', 'select=value');
    expect(calls[0].init.headers.Range).toBe('0-999');
    expect(calls[0].init.headers['Range-Unit']).toBe('items');
  });

  it('stops after one request when the page comes back short', async () => {
    stub([[{ a: 1 }, { a: 2 }]]);
    const out = await new Db(env).select('observations');
    expect(out).toHaveLength(2);
    expect(calls).toHaveLength(1);
  });

  it('keeps paging while pages come back full, and returns every row', async () => {
    // This is the bug that emptied the outcomes job: a company with daily
    // price history holds well over a thousand observations, and a single
    // unbounded request returned only the first page with no error.
    const full = Array.from({ length: 1000 }, (_, i) => ({ i }));
    const tail = Array.from({ length: 37 }, (_, i) => ({ i: 1000 + i }));
    stub([full, tail]);

    const out = await new Db(env).select('observations');
    expect(out).toHaveLength(1037);
    expect(calls).toHaveLength(2);
    expect(calls[1].init.headers.Range).toBe('1000-1999');
  });

  it('returns the most recent rows, not just the oldest, on a long series', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ date: `2021-${i}` }));
    const tail = [{ date: '2026-06-30' }];
    stub([full, tail]);
    const out = await new Db(env).select<{ date: string }>('observations');
    expect(out[out.length - 1].date).toBe('2026-06-30');
  });

  it('flags when it stopped at the page guard rather than pretending it finished', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ i }));
    stub([full, full, full]);
    const db = new Db(env);
    await db.select('observations', '', 2);
    expect(db.lastPageWasFull).toBe(true);
  });

  it('accepts a 206 Partial Content response, which PostgREST returns for a range', async () => {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 206 })));
    await expect(new Db(env).select('observations')).resolves.toEqual([]);
  });

  it('strips the trailing slash so the URL is not doubled', async () => {
    stub([[]]);
    await new Db(env).select('companies', 'select=id');
    expect(calls[0].url).toBe('https://example.supabase.co/rest/v1/companies?select=id');
  });

  it('sends both the apikey and bearer headers PostgREST expects', async () => {
    stub([[]]);
    await new Db(env).select('companies');
    expect(calls[0].init.headers.apikey).toBe('service-key');
    expect(calls[0].init.headers.Authorization).toBe('Bearer service-key');
  });

  it('surfaces the response body on failure instead of swallowing it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('permission denied for table', { status: 401 })));
    await expect(new Db(env).select('claims')).rejects.toThrow(/permission denied/);
  });
});

describe('Db.upsert', () => {
  let calls: Array<{ url: string; init: any }>;
  beforeEach(() => {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push({ url: String(url), init });
      return new Response('[]', { status: 200 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sets merge-duplicates so a re-run updates instead of erroring', async () => {
    await new Db(env).upsert('observations', [{ a: 1 }], 'company_id,series_key');
    expect(calls[0].init.headers.Prefer).toContain('resolution=merge-duplicates');
    expect(calls[0].url).toContain('on_conflict=company_id%2Cseries_key');
  });

  it('chunks large upserts into separate requests', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({ i }));
    expect(await new Db(env).upsert('observations', rows, 'x', 500)).toBe(1200);
    expect(calls).toHaveLength(3);
  });

  it('makes no request at all for an empty upsert', async () => {
    expect(await new Db(env).upsert('observations', [])).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
