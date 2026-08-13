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

describe('Db', () => {
  let calls: Array<{ url: string; init: any }>;

  beforeEach(() => {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push({ url: String(url), init });
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('strips the trailing slash so the URL is not doubled', async () => {
    await new Db(env).select('companies', 'select=id');
    expect(calls[0].url).toBe('https://example.supabase.co/rest/v1/companies?select=id');
  });

  it('sends both the apikey and bearer headers PostgREST expects', async () => {
    await new Db(env).select('companies');
    expect(calls[0].init.headers.apikey).toBe('service-key');
    expect(calls[0].init.headers.Authorization).toBe('Bearer service-key');
  });

  it('sets merge-duplicates so a re-run updates instead of erroring', async () => {
    await new Db(env).upsert('observations', [{ a: 1 }], 'company_id,series_key');
    expect(calls[0].init.headers.Prefer).toContain('resolution=merge-duplicates');
    expect(calls[0].url).toContain('on_conflict=company_id%2Cseries_key');
  });

  it('chunks large upserts into separate requests', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({ i }));
    const written = await new Db(env).upsert('observations', rows, 'x', 500);
    expect(calls).toHaveLength(3);
    expect(written).toBe(1200);
  });

  it('makes no request at all for an empty upsert', async () => {
    expect(await new Db(env).upsert('observations', [])).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('surfaces the response body on failure instead of swallowing it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('permission denied for table', { status: 401 })));
    await expect(new Db(env).select('claims')).rejects.toThrow(/permission denied/);
  });
});
