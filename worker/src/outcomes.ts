import { addDays } from './quarterly';

/**
 * "What happened to margin afterward" is the column that would rot fastest if
 * a human maintained it, so a human does not maintain it. This derives it from
 * the observation series on every run.
 *
 * The windows are deliberately strict. A margin reading picked up 100 days off
 * the intended date is not a data point, it is a different quarter, and letting
 * it through would produce a chart that looks fine and says nothing.
 */

export interface Point {
  date: string;
  value: number;
}

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
}

const EMPTY: Outcome = {
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
  /** How far before the claim we will look for a baseline reading. */
  baselineLookbackDays?: number;
  /** Tolerance around the +1 quarter target. */
  q1ToleranceDays?: number;
  /** Tolerance around the +4 quarter target. */
  q4ToleranceDays?: number;
  /** Multiply deltas by 10,000 to express a ratio change in basis points. */
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

function lastAtOrBefore(points: Point[], iso: string, lookbackDays: number): Point | null {
  let best: Point | null = null;
  for (const p of points) {
    if (p.date > iso) continue;
    const gap = (Date.parse(iso + 'T00:00:00Z') - Date.parse(p.date + 'T00:00:00Z')) / 86_400_000;
    if (gap > lookbackDays) continue;
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
    baselineLookbackDays = 200,
    q1ToleranceDays = 50,
    q4ToleranceDays = 70,
    asBps = false,
  } = opts;

  if (!points || points.length === 0) return { ...EMPTY };
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));

  const baseline = lastAtOrBefore(sorted, claimDateIso, baselineLookbackDays);
  if (!baseline) return { ...EMPTY };

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
  };
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Price series are daily, so a "quarter later" reading is always available;
 *  the delta is expressed as a percentage change rather than an absolute. */
export function computePriceOutcome(points: Point[], claimDateIso: string): Outcome {
  const o = computeOutcome(points, claimDateIso, {
    baselineLookbackDays: 30,
    q1ToleranceDays: 10,
    q4ToleranceDays: 15,
  });
  if (o.baseline_value && o.baseline_value !== 0) {
    if (o.t1q_value !== null) o.delta_1q = pct(o.t1q_value, o.baseline_value);
    if (o.t4q_value !== null) o.delta_4q = pct(o.t4q_value, o.baseline_value);
  }
  return o;
}

function pct(now: number, then: number): number {
  return Math.round(((now - then) / then) * 1000) / 10;
}
