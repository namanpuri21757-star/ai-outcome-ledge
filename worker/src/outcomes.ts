import { addDays } from './quarterly';

/**
 * "What happened to margin afterwards" is the column that would rot
 * fastest if a human maintained it, so a human does not. It is derived
 * from the observation series on every run.
 *
 * ── Two fixes in this version ─────────────────────────────────────
 *
 * 1. Every attempt now returns a `reason`. Before, a claim that could
 *    not be measured produced nothing at all: no row, no error, no
 *    trace. A run could report success with zero rows written and give
 *    no way to find out why. Now the reason is always stated, counted,
 *    and reported in the run summary.
 *
 * 2. The baseline lookback widens from 200 to 400 days. Quarterly
 *    filings arrive months after the period they describe, and a claim
 *    made early in a fiscal year can legitimately sit more than two
 *    quarters after the most recent published period end. 200 days
 *    rejected those as unmeasurable when the data was there.
 *
 * The forward tolerances stay strict on purpose. A margin reading picked
 * up 100 days off the intended date is not a data point, it is a
 * different quarter, and letting it through produces a chart that looks
 * fine and says nothing.
 */

export interface Point {
  date: string;
  value: number;
}

export type OutcomeReason =
  | 'ok'
  | 'no_series'
  | 'no_baseline_before_claim'
  | 'baseline_too_old'
  | 'no_forward_reading';

export interface Outcome {
  baseline_at: string | null;
  baseline_value: number | null;
  t1q_at: string | null;
  t1q_value: number | null;
  t4q_at: string | null;
  t4q_value: number | null;
  delta_1q: number | null;
  delta_4q: number | null;
  delta_1q_bps: number | null;
  delta_4q_bps: number | null;
  /** Why this outcome looks the way it does. Never null. */
  reason: OutcomeReason;
}

const EMPTY: Omit<Outcome, 'reason'> = {
  baseline_at: null,
  baseline_value: null,
  t1q_at: null,
  t1q_value: null,
  t4q_at: null,
  t4q_value: null,
  delta_1q: null,
  delta_4q: null,
  delta_1q_bps: null,
  delta_4q_bps: null,
};

export interface WindowOpts {
  baselineLookbackDays?: number;
  q1ToleranceDays?: number;
  q4ToleranceDays?: number;
  asBps?: boolean;
}

function nearest(points: Point[], targetIso: string, toleranceDays: number): Point | null {
  let best: Point | null = null;
  let bestGap = Infinity;
  const target = Date.parse(targetIso + 'T00:00:00Z');
  for (const p of points) {
    const gap = Math.abs(Date.parse(p.date + 'T00:00:00Z') - target) / 86_400_000;
    if (gap <= toleranceDays && gap < bestGap) {
      best = p;
      bestGap = gap;
    }
  }
  return best;
}

function lastAtOrBefore(points: Point[], iso: string): Point | null {
  let best: Point | null = null;
  for (const p of points) {
    if (p.date > iso) continue;
    if (!best || p.date > best.date) best = p;
  }
  return best;
}

export function computeOutcome(
  points: Point[],
  claimDateIso: string,
  opts: WindowOpts = {},
): Outcome {
  const {
    baselineLookbackDays = 400,
    q1ToleranceDays = 50,
    q4ToleranceDays = 70,
    asBps = false,
  } = opts;

  if (!points || points.length === 0) return { ...EMPTY, reason: 'no_series' };
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));

  const candidate = lastAtOrBefore(sorted, claimDateIso);
  if (!candidate) return { ...EMPTY, reason: 'no_baseline_before_claim' };

  const ageDays =
    (Date.parse(claimDateIso + 'T00:00:00Z') - Date.parse(candidate.date + 'T00:00:00Z')) / 86_400_000;
  if (ageDays > baselineLookbackDays) return { ...EMPTY, reason: 'baseline_too_old' };

  const baseline = candidate;
  const t1 = nearest(sorted, addDays(claimDateIso, 91), q1ToleranceDays);
  const t4 = nearest(sorted, addDays(claimDateIso, 365), q4ToleranceDays);

  const d1 = t1 ? round6(t1.value - baseline.value) : null;
  const d4 = t4 ? round6(t4.value - baseline.value) : null;

  return {
    baseline_at: baseline.date,
    baseline_value: baseline.value,
    t1q_at: t1?.date ?? null,
    t1q_value: t1?.value ?? null,
    t4q_at: t4?.date ?? null,
    t4q_value: t4?.value ?? null,
    delta_1q: d1,
    delta_4q: d4,
    delta_1q_bps: asBps && d1 !== null ? Math.round(d1 * 10000 * 10) / 10 : null,
    delta_4q_bps: asBps && d4 !== null ? Math.round(d4 * 10000 * 10) / 10 : null,
    // A baseline with no forward reading is still worth storing: it is
    // the difference between "not measurable" and "not measurable yet".
    reason: t1 || t4 ? 'ok' : 'no_forward_reading',
  };
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Price series are daily, so the change is expressed as a percentage. */
export function computePriceOutcome(points: Point[], claimDateIso: string): Outcome {
  const o = computeOutcome(points, claimDateIso, {
    baselineLookbackDays: 30,
    q1ToleranceDays: 10,
    q4ToleranceDays: 15,
  });
  if (o.baseline_value !== null && o.baseline_value !== 0) {
    if (o.t1q_value !== null) o.delta_1q = pct(o.t1q_value, o.baseline_value);
    if (o.t4q_value !== null) o.delta_4q = pct(o.t4q_value, o.baseline_value);
  }
  return o;
}

function pct(now: number, then: number): number {
  return Math.round(((now - then) / then) * 1000) / 10;
}

/** Human-readable explanation of a reason code, for the run summary. */
export const REASON_TEXT: Record<OutcomeReason, string> = {
  ok: 'measured',
  no_series: 'no observation series for this company',
  no_baseline_before_claim: 'the series starts after the claim date',
  baseline_too_old: 'the nearest prior reading is more than the lookback window before the claim',
  no_forward_reading: 'a baseline exists but the series does not yet reach forward of the claim',
};

/** The row written to claim_outcomes. `reason` is not a column, so it is
 *  stripped here rather than at every call site. */
export function toRow(claimId: string, seriesKey: string, o: Outcome): Record<string, unknown> {
  const { reason, ...cols } = o;
  void reason;
  return { claim_id: claimId, series_key: seriesKey, ...cols, computed_at: new Date().toISOString() };
}
