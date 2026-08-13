import { describe, expect, it } from 'vitest';
import { computeOutcome, computePriceOutcome, type Point } from '../src/outcomes';

// A quarterly operating-margin series, expressed as a ratio.
const margin: Point[] = [
  { date: '2024-12-31', value: 0.213 },
  { date: '2025-03-31', value: 0.211 },
  { date: '2025-06-30', value: 0.209 },
  { date: '2025-09-30', value: 0.212 },
  { date: '2025-12-31', value: 0.211 },
  { date: '2026-03-31', value: 0.208 },
];

describe('computeOutcome', () => {
  it('uses the last reading at or before the claim as the baseline', () => {
    const o = computeOutcome(margin, '2025-02-14');
    expect(o.baseline_at).toBe('2024-12-31');
    expect(o.baseline_value).toBe(0.213);
  });

  it('finds the quarter after and the year after', () => {
    const o = computeOutcome(margin, '2024-12-31');
    expect(o.t1q_at).toBe('2025-03-31');
    expect(o.t4q_at).toBe('2025-12-31');
  });

  it('converts a ratio delta to basis points when asked', () => {
    const o = computeOutcome(margin, '2024-12-31', { asBps: true });
    // 0.211 - 0.213 = -0.002 -> -20bps
    expect(o.delta_1q_bps).toBeCloseTo(-20, 5);
    expect(o.delta_4q_bps).toBeCloseTo(-20, 5);
  });

  it('leaves basis points null when not requested, so units cannot be confused', () => {
    const o = computeOutcome(margin, '2024-12-31');
    expect(o.delta_1q_bps).toBeNull();
    expect(o.delta_1q).toBeCloseTo(-0.002, 6);
  });

  it('returns an empty outcome when there is no reading before the claim', () => {
    const o = computeOutcome(margin, '2020-01-01');
    expect(o.baseline_at).toBeNull();
    expect(o.delta_4q).toBeNull();
  });

  it('refuses a stale baseline beyond the lookback window', () => {
    const sparse: Point[] = [{ date: '2020-03-31', value: 0.1 }];
    expect(computeOutcome(sparse, '2025-01-01').baseline_at).toBeNull();
  });

  it('leaves the forward readings null when the series stops', () => {
    const o = computeOutcome(margin, '2026-03-31');
    expect(o.baseline_at).toBe('2026-03-31');
    expect(o.t4q_at).toBeNull();
    expect(o.delta_4q).toBeNull();
  });

  it('will not stretch to a reading outside the tolerance', () => {
    // Only an annual series exists: nothing sits within 50 days of +1 quarter.
    const annual: Point[] = [
      { date: '2024-12-31', value: 0.2 },
      { date: '2025-12-31', value: 0.25 },
    ];
    const o = computeOutcome(annual, '2024-12-31');
    expect(o.t1q_at).toBeNull();
    expect(o.t4q_at).toBe('2025-12-31');
  });

  it('picks the nearest reading when two fall inside the tolerance', () => {
    const dense: Point[] = [
      { date: '2025-01-01', value: 1 },
      { date: '2025-03-25', value: 2 },
      { date: '2025-04-05', value: 3 },
    ];
    // claim 2025-01-01 -> target 2025-04-02; 04-05 is 3 days away, 03-25 is 8
    expect(computeOutcome(dense, '2025-01-01').t1q_value).toBe(3);
  });

  it('handles an unsorted input', () => {
    const shuffled = [...margin].reverse();
    expect(computeOutcome(shuffled, '2024-12-31').t1q_at).toBe('2025-03-31');
  });

  it('returns an empty outcome for an empty series', () => {
    expect(computeOutcome([], '2025-01-01').baseline_at).toBeNull();
  });
});

describe('computePriceOutcome', () => {
  const daily: Point[] = [];
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10);
    daily.push({ date: d, value: 100 + i * 0.1 });
  }

  it('expresses the change as a percentage, not an absolute', () => {
    const o = computePriceOutcome(daily, '2025-01-01');
    expect(o.baseline_value).toBe(100);
    // +365 days -> 100 + 36.5 = 136.5 -> +36.5%
    expect(o.delta_4q).toBeCloseTo(36.5, 1);
  });

  it('uses a tight baseline window because prices are daily', () => {
    const stale: Point[] = [{ date: '2024-01-01', value: 50 }];
    expect(computePriceOutcome(stale, '2025-06-01').baseline_at).toBeNull();
  });

  it('does not divide by a zero baseline', () => {
    const zeros: Point[] = [
      { date: '2025-01-01', value: 0 },
      { date: '2025-04-02', value: 5 },
    ];
    const o = computePriceOutcome(zeros, '2025-01-01');
    expect(Number.isFinite(o.delta_1q ?? 0)).toBe(true);
  });
});
