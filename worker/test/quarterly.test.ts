import { describe, expect, it } from 'vitest';
import {
  addDays,
  bucketOf,
  computeMarginSeries,
  daysBetween,
  dedupeByPeriod,
  fiscalPeriodLabel,
  toQuarterlySeries,
} from '../src/quarterly';
import type { XbrlFact } from '../src/types';

const q = (start: string, end: string, val: number, extra: Partial<XbrlFact> = {}): XbrlFact => ({
  start,
  end,
  val,
  form: '10-Q',
  filed: end,
  accn: `acc-${end}`,
  ...extra,
});

describe('date helpers', () => {
  it('counts days across a quarter', () => {
    expect(daysBetween('2025-01-01', '2025-03-31')).toBe(89);
  });

  it('handles leap years', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
  });

  it('adds and subtracts days across month boundaries', () => {
    expect(addDays('2025-03-31', 1)).toBe('2025-04-01');
    expect(addDays('2025-01-01', -1)).toBe('2024-12-31');
  });

  it('labels the calendar quarter a period ends in', () => {
    expect(fiscalPeriodLabel('2025-03-31')).toBe('CY2025Q1');
    expect(fiscalPeriodLabel('2025-12-31')).toBe('CY2025Q4');
    // an odd fiscal year still lands in the calendar quarter it ends in
    expect(fiscalPeriodLabel('2026-01-31')).toBe('CY2026Q1');
  });
});

describe('bucketOf', () => {
  it('classifies the four period lengths that matter', () => {
    expect(bucketOf(90)).toBe('Q');
    expect(bucketOf(181)).toBe('H');
    expect(bucketOf(273)).toBe('T');
    expect(bucketOf(365)).toBe('FY');
  });

  it('refuses to classify a period that is between buckets', () => {
    expect(bucketOf(130)).toBe('other');
    expect(bucketOf(NaN)).toBe('other');
  });
});

describe('dedupeByPeriod', () => {
  it('keeps the most recently filed value for a restated period', () => {
    const rows = dedupeByPeriod([
      q('2025-01-01', '2025-03-31', 100, { filed: '2025-04-20' }),
      q('2025-01-01', '2025-03-31', 112, { filed: '2025-08-05' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].val).toBe(112);
  });

  it('prefers the annual form when two filings share a filed date', () => {
    const rows = dedupeByPeriod([
      q('2025-01-01', '2025-03-31', 100, { filed: '2026-02-01', form: '10-Q' }),
      q('2025-01-01', '2025-03-31', 105, { filed: '2026-02-01', form: '10-K' }),
    ]);
    expect(rows[0].val).toBe(105);
  });

  it('drops facts without a start date, which are instantaneous not duration', () => {
    const rows = dedupeByPeriod([{ end: '2025-03-31', val: 500 } as XbrlFact]);
    expect(rows).toHaveLength(0);
  });

  it('drops non-numeric values rather than coercing them', () => {
    const rows = dedupeByPeriod([q('2025-01-01', '2025-03-31', NaN)]);
    expect(rows).toHaveLength(0);
  });
});

describe('toQuarterlySeries', () => {
  it('passes through four discretely tagged quarters unchanged', () => {
    const series = toQuarterlySeries([
      q('2025-01-01', '2025-03-31', 10),
      q('2025-04-01', '2025-06-30', 20),
      q('2025-07-01', '2025-09-30', 30),
      q('2025-10-01', '2025-12-31', 40),
    ]);
    expect(series.map((s) => s.val)).toEqual([10, 20, 30, 40]);
    expect(series.every((s) => s.origin === 'reported')).toBe(true);
  });

  it('derives Q4 by subtracting three quarters from the full year', () => {
    const series = toQuarterlySeries([
      q('2025-01-01', '2025-03-31', 10),
      q('2025-04-01', '2025-06-30', 20),
      q('2025-07-01', '2025-09-30', 30),
      q('2025-01-01', '2025-12-31', 100, { form: '10-K', filed: '2026-02-15' }),
    ]);
    const q4 = series.find((s) => s.end === '2025-12-31');
    expect(q4?.val).toBe(40);
    expect(q4?.origin).toBe('derived');
  });

  it('derives Q2 from a half-year filing, the classic year-to-date trap', () => {
    // A filer that tags Q1 discretely and Q2 as year-to-date. Read naively,
    // the 181-day fact would be recorded as a quarter worth 50 instead of 30.
    const series = toQuarterlySeries([
      q('2025-01-01', '2025-03-31', 20),
      q('2025-01-01', '2025-06-30', 50),
    ]);
    expect(series.map((s) => [s.end, s.val])).toEqual([
      ['2025-03-31', 20],
      ['2025-06-30', 30],
    ]);
  });

  it('cascades: half-year unlocks Q2, then nine-month unlocks Q3, then FY unlocks Q4', () => {
    const series = toQuarterlySeries([
      q('2025-01-01', '2025-03-31', 20),
      q('2025-01-01', '2025-06-30', 50),
      q('2025-01-01', '2025-09-30', 90),
      q('2025-01-01', '2025-12-31', 150, { form: '10-K' }),
    ]);
    expect(series.map((s) => s.val)).toEqual([20, 30, 40, 60]);
    expect(series.filter((s) => s.origin === 'derived')).toHaveLength(3);
  });

  it('refuses to derive when the gap is in the middle and therefore ambiguous', () => {
    // Q1 and Q3 known, Q2 missing, FY known. The arithmetic would produce a
    // number, but it would be Q2+Q4 combined. Better to emit nothing.
    const series = toQuarterlySeries([
      q('2025-01-01', '2025-03-31', 20),
      q('2025-07-01', '2025-09-30', 40),
      q('2025-01-01', '2025-12-31', 150, { form: '10-K' }),
    ]);
    expect(series.map((s) => s.end)).toEqual(['2025-03-31', '2025-09-30']);
  });

  it('does not overwrite a reported quarter with a derived one', () => {
    const series = toQuarterlySeries([
      q('2025-01-01', '2025-03-31', 20),
      q('2025-04-01', '2025-06-30', 31),
      q('2025-01-01', '2025-06-30', 50), // implies 30, but Q2 was reported as 31
    ]);
    const q2 = series.find((s) => s.end === '2025-06-30');
    expect(q2?.val).toBe(31);
    expect(q2?.origin).toBe('reported');
  });

  it('handles a non-calendar fiscal year', () => {
    // Fiscal year ending 31 January, as Salesforce and many retailers file.
    const series = toQuarterlySeries([
      q('2025-02-01', '2025-04-30', 10),
      q('2025-05-01', '2025-07-31', 12),
      q('2025-08-01', '2025-10-31', 14),
      q('2025-02-01', '2026-01-31', 50, { form: '10-K' }),
    ]);
    const q4 = series.find((s) => s.end === '2026-01-31');
    expect(q4?.val).toBe(14);
    expect(q4?.fiscalPeriod).toBe('CY2026Q1');
  });

  it('survives an empty input', () => {
    expect(toQuarterlySeries([])).toEqual([]);
  });
});

describe('computeMarginSeries', () => {
  it('joins strictly on period end', () => {
    const rev = toQuarterlySeries([q('2025-01-01', '2025-03-31', 1000), q('2025-04-01', '2025-06-30', 1200)]);
    const oi = toQuarterlySeries([q('2025-01-01', '2025-03-31', 200)]);
    const margin = computeMarginSeries(rev, oi);
    expect(margin).toHaveLength(1);
    expect(margin[0].value).toBeCloseTo(0.2, 6);
  });

  it('emits nothing when the periods do not line up, rather than guessing', () => {
    const rev = toQuarterlySeries([q('2025-01-01', '2025-03-31', 1000)]);
    const oi = toQuarterlySeries([q('2025-04-01', '2025-06-30', 200)]);
    expect(computeMarginSeries(rev, oi)).toEqual([]);
  });

  it('skips periods with zero or negative revenue instead of dividing by them', () => {
    const rev = toQuarterlySeries([q('2025-01-01', '2025-03-31', 0)]);
    const oi = toQuarterlySeries([q('2025-01-01', '2025-03-31', -50)]);
    expect(computeMarginSeries(rev, oi)).toEqual([]);
  });

  it('carries negative margins through, because loss-making quarters are the interesting ones', () => {
    const rev = toQuarterlySeries([q('2025-01-01', '2025-03-31', 1000)]);
    const oi = toQuarterlySeries([q('2025-01-01', '2025-03-31', -150)]);
    expect(computeMarginSeries(rev, oi)[0].value).toBeCloseTo(-0.15, 6);
  });
});
