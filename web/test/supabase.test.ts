import { describe, expect, it } from 'vitest';
import { PAGE, TruncatedError, fetchAll, friendlyError, indexSeries } from '../src/lib/supabase';
import type { CompanyRef, Observation } from '../src/lib/types';

/* ===================================================================
   PostgREST answers an over-cap request with HTTP 200 and a truncated
   body. There is no error and no flag, so a client that asks once and
   trusts the answer computes its figures from part of the table and
   says nothing. The previous build had one query capped at 2000 and one
   with no bound at all, and neither could tell a complete answer from a
   clipped one.
   =================================================================== */

/** A fake table that behaves the way PostgREST does. */
function table<T>(rows: T[], cap = Infinity) {
  const calls: Array<[number, number]> = [];
  const build = () => ({
    async range(from: number, to: number) {
      calls.push([from, to]);
      const wanted = rows.slice(from, to + 1);
      // The server refuses to send more than `cap` rows, silently.
      return { data: wanted.slice(0, cap), error: null };
    },
  });
  return { build, calls };
}

const many = (n: number) => Array.from({ length: n }, (_, i) => ({ i }));

describe('fetchAll', () => {
  it('asks for an explicit range rather than trusting a default', async () => {
    const t = table(many(3));
    await fetchAll('t', t.build);
    expect(t.calls[0]).toEqual([0, PAGE - 1]);
  });

  it('stops after one request when the first page comes back short', async () => {
    const t = table(many(3));
    expect(await fetchAll('t', t.build)).toHaveLength(3);
    expect(t.calls).toHaveLength(1);
  });

  it('keeps paging while pages come back full, and returns every row', async () => {
    const t = table(many(1250), Infinity);
    const out = await fetchAll<{ i: number }>('t', t.build, 500);
    expect(out).toHaveLength(1250);
    expect(t.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it('returns the last rows, not only the first — the truncation symptom', async () => {
    const t = table(many(1250));
    const out = await fetchAll<{ i: number }>('t', t.build, 500);
    expect(out[out.length - 1].i).toBe(1249);
  });

  it('returns exactly the rows that exist when the count is a page multiple', async () => {
    const t = table(many(1000));
    const out = await fetchAll('t', t.build, 500);
    expect(out).toHaveLength(1000);
    // Three requests: the third proves there is nothing after 1000.
    expect(t.calls).toHaveLength(3);
  });

  it('throws rather than returning a silently partial answer', async () => {
    // A table that never runs out: this is what a page guard is for.
    const build = () => ({
      async range(from: number, to: number) {
        return { data: many(to - from + 1), error: null };
      },
    });
    await expect(fetchAll('observations', build, 500, 3)).rejects.toThrow(TruncatedError);
    await expect(fetchAll('observations', build, 500, 3)).rejects.toThrow(/stopped after 1,?500 rows|stopped after 1500 rows/);
  });

  it('surfaces a server error instead of treating it as an empty table', async () => {
    const build = () => ({
      async range() {
        return { data: null, error: { message: 'permission denied for table observations' } };
      },
    });
    await expect(fetchAll('observations', build)).rejects.toThrow(/permission denied/);
  });

  it('treats a null body as no rows rather than crashing', async () => {
    const build = () => ({ async range() { return { data: null, error: null }; } });
    expect(await fetchAll('t', build)).toEqual([]);
  });
});

describe('indexSeries', () => {
  const companies: CompanyRef[] = [
    { id: 'c1', slug: 'ibm', cik: '1', is_public: true },
    { id: 'c2', slug: 'wtw', cik: '2', is_public: true },
  ];
  const observations: Observation[] = [
    { company_id: 'c1', series_key: 'operating_margin_q', observed_at: '2025-06-30', value: 0.2 },
    { company_id: 'c1', series_key: 'operating_margin_q', observed_at: '2024-06-30', value: 0.1 },
    { company_id: 'c1', series_key: 'revenue_q', observed_at: '2025-06-30', value: 1000 },
    { company_id: 'c2', series_key: 'operating_margin_q', observed_at: '2025-06-30', value: 0.3 },
    { company_id: 'unknown', series_key: 'operating_margin_q', observed_at: '2025-06-30', value: 9 },
  ];

  const index = indexSeries(companies, observations);

  it('keys by slug, because nothing on screen knows a company id', () => {
    expect([...index.keys()].sort()).toEqual(['ibm', 'wtw']);
  });

  it('separates the series for one company', () => {
    expect(index.get('ibm')!.get('operating_margin_q')).toHaveLength(2);
    expect(index.get('ibm')!.get('revenue_q')).toHaveLength(1);
  });

  it('sorts each series oldest first, whatever order it arrived in', () => {
    expect(index.get('ibm')!.get('operating_margin_q')!.map((p) => p.date)).toEqual([
      '2024-06-30', '2025-06-30',
    ]);
  });

  it('drops an observation for a company that is not in the ledger', () => {
    expect(index.has('unknown')).toBe(false);
  });

  it('coerces the numeric value, which PostgREST returns as a string', () => {
    const withStrings = indexSeries(companies, [
      { company_id: 'c1', series_key: 'revenue_q', observed_at: '2025-06-30', value: '1234' as never },
    ]);
    expect(withStrings.get('ibm')!.get('revenue_q')![0].value).toBe(1234);
  });

  it('is empty and safe with no observations', () => {
    expect(indexSeries(companies, []).size).toBe(0);
  });
});

describe('friendlyError', () => {
  it('explains a missing view as a setup step rather than a database error', () => {
    expect(friendlyError('relation "v_ledger" does not exist')).toContain('Run the SQL files');
  });

  it('explains a network failure in terms the reader can act on', () => {
    expect(friendlyError('Failed to fetch')).toContain('Supabase project is paused');
  });

  it('passes anything else through unchanged rather than guessing', () => {
    expect(friendlyError('something specific')).toBe('something specific');
  });
});
