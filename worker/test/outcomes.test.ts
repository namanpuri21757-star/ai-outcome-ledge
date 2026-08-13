import { describe, expect, it } from 'vitest';
import { REASON_TEXT, computeOutcome, computePriceOutcome, toRow, type Point } from '../src/outcomes';

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
    expect(o.reason).toBe('ok');
  });

  it('converts a ratio delta to basis points only when asked', () => {
    expect(computeOutcome(margin, '2024-12-31', { asBps: true }).delta_1q_bps).toBeCloseTo(-20, 5);
    expect(computeOutcome(margin, '2024-12-31').delta_1q_bps).toBeNull();
  });

  it('always states a reason, so a run that writes nothing can be diagnosed', () => {
    for (const iso of ['2020-01-01', '2025-02-14', '2026-03-31']) {
      expect(REASON_TEXT[computeOutcome(margin, iso).reason]).toBeTruthy();
    }
  });

  it('reports no_series for an empty series rather than failing silently', () => {
    expect(computeOutcome([], '2025-01-01').reason).toBe('no_series');
  });

  it('reports no_baseline_before_claim when the series starts after the claim', () => {
    expect(computeOutcome(margin, '2020-01-01').reason).toBe('no_baseline_before_claim');
  });

  it('reports baseline_too_old rather than pretending the gap is fine', () => {
    const stale: Point[] = [{ date: '2020-03-31', value: 0.1 }];
    const o = computeOutcome(stale, '2025-01-01');
    expect(o.reason).toBe('baseline_too_old');
    expect(o.baseline_at).toBeNull();
  });

  it('accepts a baseline up to 400 days back, which 200 days wrongly rejected', () => {
    // A quarterly filer whose most recent published period end is three
    // quarters before a claim made early in a fiscal year. The data is
    // there; the old window threw it away.
    const sparse: Point[] = [{ date: '2025-03-31', value: 0.2 }, { date: '2026-03-31', value: 0.26 }];
    const o = computeOutcome(sparse, '2026-02-15', { asBps: true });
    expect(o.reason).not.toBe('baseline_too_old');
    expect(o.baseline_at).toBe('2025-03-31');
  });

  it('still refuses a baseline beyond the widened window', () => {
    const sparse: Point[] = [{ date: '2023-03-31', value: 0.2 }];
    expect(computeOutcome(sparse, '2026-02-15').reason).toBe('baseline_too_old');
  });

  it('keeps a baseline-only outcome and marks it as not yet forward-reaching', () => {
    const o = computeOutcome(margin, '2026-03-31');
    expect(o.baseline_at).toBe('2026-03-31');
    expect(o.t4q_at).toBeNull();
    expect(o.reason).toBe('no_forward_reading');
  });

  it('will not stretch to a reading outside the forward tolerance', () => {
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
    expect(computeOutcome(dense, '2025-01-01').t1q_value).toBe(3);
  });

  it('handles an unsorted input', () => {
    expect(computeOutcome([...margin].reverse(), '2024-12-31').t1q_at).toBe('2025-03-31');
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
    expect(o.delta_4q).toBeCloseTo(36.5, 1);
  });

  it('keeps a tight baseline window because prices are daily', () => {
    expect(computePriceOutcome([{ date: '2024-01-01', value: 50 }], '2025-06-01').reason)
      .toBe('baseline_too_old');
  });

  it('does not divide by a zero baseline', () => {
    const zeros: Point[] = [{ date: '2025-01-01', value: 0 }, { date: '2025-04-02', value: 5 }];
    expect(Number.isFinite(computePriceOutcome(zeros, '2025-01-01').delta_1q ?? 0)).toBe(true);
  });
});

describe('toRow', () => {
  it('strips the reason, which is diagnostic and not a column', () => {
    const row = toRow('claim-1', 'operating_margin_q', computeOutcome(margin, '2024-12-31'));
    expect(row).not.toHaveProperty('reason');
    expect(row.claim_id).toBe('claim-1');
    expect(row.series_key).toBe('operating_margin_q');
    expect(row).toHaveProperty('delta_4q_bps');
  });

  it('stamps a computed_at so a stale derivation is visible', () => {
    const row = toRow('c', 's', computeOutcome(margin, '2024-12-31'));
    expect(typeof row.computed_at).toBe('string');
  });
});
