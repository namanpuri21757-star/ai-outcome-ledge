import type { LedgerRow } from './types';

/* ===================================================================
   "Did the claim show up in the financials?"

   The previous build answered this with a quarterly operating-margin
   line chart swinging between −40% and +40% with two dashed claim dates
   drawn on it. It was decorative: a reader could not get an answer off
   it, and for 84 of 84 rows the derived margin columns were empty
   anyway, so every figure beside it read as an em dash.

   What replaces it is a window, not a series: the last operating margin
   the company filed *before* the claim, the reading a quarter after, and
   the reading a year after — each with its own date — plus a delta and a
   sentence saying what that delta can and cannot support.

   ── Why the reason is computed here and not stored ────────────────

   `claim_outcomes` has no column for "why is this blank", and the
   Worker writes no row at all when a claim cannot be measured. So the
   interface would have nothing to distinguish "this company does not
   file with the SEC" from "a year has not passed yet" from "the
   collector is broken" — and those are three completely different
   things for a reader to know.

   Deriving it in the browser from the observation coverage is strictly
   better than a stored code would have been: the explanation can name
   the actual date range that exists, so the reader can check it.

   The window arithmetic below mirrors `worker/src/outcomes.ts`
   deliberately, and `test/outcome.test.ts` pins the constants to the
   Worker's, so the two cannot drift into disagreeing about the same
   claim.
   =================================================================== */

export const BASELINE_LOOKBACK_DAYS = 400;
export const Q1_TOLERANCE_DAYS = 50;
export const Q4_TOLERANCE_DAYS = 70;

export const MARGIN_SERIES = 'operating_margin_q';
export const REVENUE_SERIES = 'revenue_q';

export interface Reading {
  date: string;
  /** A ratio, e.g. 0.188344 for 18.83%. */
  value: number;
}

export type MeasureStatus =
  | 'measured'
  | 'too_soon'
  | 'series_starts_late'
  | 'baseline_stale'
  | 'no_series'
  | 'not_a_filer'
  | 'not_a_company';

export interface MarginWindow {
  status: MeasureStatus;
  /** True only for `measured`. Everything else has a reason to show. */
  hasFigure: boolean;
  baseline: Reading | null;
  q1: Reading | null;
  q4: Reading | null;
  delta1qBps: number | null;
  delta4qBps: number | null;
  /** The range of readings that exist for this company at all. */
  coverage: { first: string; last: string } | null;
  /** One plain sentence. Never empty, whatever the status. */
  reason: string;
}

const NONE: Omit<MarginWindow, 'status' | 'reason' | 'coverage'> = {
  hasFigure: false,
  baseline: null,
  q1: null,
  q4: null,
  delta1qBps: null,
  delta4qBps: null,
};

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86_400_000;
}

function lastAtOrBefore(points: Reading[], iso: string): Reading | null {
  let best: Reading | null = null;
  for (const p of points) {
    if (p.date > iso) continue;
    if (!best || p.date > best.date) best = p;
  }
  return best;
}

function nearest(points: Reading[], targetIso: string, toleranceDays: number): Reading | null {
  let best: Reading | null = null;
  let bestGap = Infinity;
  for (const p of points) {
    const gap = daysBetween(p.date, targetIso);
    if (gap <= toleranceDays && gap < bestGap) {
      best = p;
      bestGap = gap;
    }
  }
  return best;
}

const bpsOf = (a: number, b: number) => Math.round((a - b) * 10000 * 10) / 10;

/**
 * Why a company can have no series at all. Ordered most specific first:
 * a research population is not a company that failed to file, it is not
 * a company.
 */
function absentReason(row: LedgerRow): { status: MeasureStatus; reason: string } {
  if (row.group_code === 'R') {
    return {
      status: 'not_a_company',
      reason:
        'This row is a population-level research finding rather than a claim by one company, so there is no filing to check it against.',
    };
  }
  if (!row.company_is_public) {
    return {
      status: 'not_a_filer',
      reason: `${row.company_name} is not an SEC filer, so no operating-margin series exists to measure this claim against. That is a fact about the company, not a gap in the collection.`,
    };
  }
  return {
    status: 'no_series',
    reason: `${row.company_name} files with the SEC but publishes no us-gaap operating-margin figures the collector can read — usually a foreign private issuer reporting under IFRS.`,
  };
}

/**
 * @param points the company's `operating_margin_q` readings, any order.
 */
export function marginWindow(row: LedgerRow, points: Reading[] | undefined): MarginWindow {
  if (!points || points.length === 0) {
    const { status, reason } = absentReason(row);
    return { ...NONE, status, reason, coverage: null };
  }

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const coverage = { first: sorted[0].date, last: sorted[sorted.length - 1].date };

  const candidate = lastAtOrBefore(sorted, row.claim_date);
  if (!candidate) {
    return {
      ...NONE,
      status: 'series_starts_late',
      coverage,
      reason: `The filed operating-margin series for ${row.company_name} starts on ${coverage.first}, after this claim was made on ${row.claim_date}, so there is no reading to use as a baseline.`,
    };
  }

  if (daysBetween(row.claim_date, candidate.date) > BASELINE_LOOKBACK_DAYS) {
    return {
      ...NONE,
      status: 'baseline_stale',
      coverage,
      reason: `The nearest filed operating margin before this claim is from ${candidate.date}, more than ${BASELINE_LOOKBACK_DAYS} days earlier. It is too far back to serve as a baseline for a claim dated ${row.claim_date}.`,
    };
  }

  const q1 = nearest(sorted, addDays(row.claim_date, 91), Q1_TOLERANCE_DAYS);
  const q4 = nearest(sorted, addDays(row.claim_date, 365), Q4_TOLERANCE_DAYS);

  if (!q1 && !q4) {
    return {
      ...NONE,
      status: 'too_soon',
      baseline: candidate,
      coverage,
      reason: `A baseline exists — ${row.company_name} filed an operating margin for the quarter ending ${candidate.date} — but the series only runs to ${coverage.last}, which does not yet reach a quarter past this claim. It is not measurable yet rather than not measurable.`,
    };
  }

  const delta1qBps = q1 ? bpsOf(q1.value, candidate.value) : null;
  const delta4qBps = q4 ? bpsOf(q4.value, candidate.value) : null;
  const far = q4 ?? q1!;
  const farDelta = (delta4qBps ?? delta1qBps)!;
  const span = q4 ? 'a year' : 'a quarter';

  return {
    hasFigure: true,
    status: 'measured',
    baseline: candidate,
    q1,
    q4,
    delta1qBps,
    delta4qBps,
    coverage,
    reason: `Operating margin ${direction(farDelta)} between the quarter ending ${candidate.date} and the quarter ending ${far.date}, ${span} after the claim.`,
  };
}

function direction(bps: number): string {
  if (bps > 0) return 'rose';
  if (bps < 0) return 'fell';
  return 'did not move';
}

/**
 * What a measured delta does and does not establish. Always shown beside
 * the figure, because a margin that moved the right way is the single
 * easiest thing on this site to over-read.
 */
export function marginCaveat(w: MarginWindow, row: LedgerRow): string {
  if (!w.hasFigure) return '';
  const moved = (w.delta4qBps ?? w.delta1qBps)!;
  if (moved === 0) {
    return 'A margin that did not move is not proof the claim is wrong: a real saving can be spent, reinvested, or offset by costs rising elsewhere in the same period.';
  }
  const withClaim = moved > 0 ? 'in the same direction as the claim' : 'against the claim';
  return `This is a reading of the whole company, not of the claim. Operating margin moved ${withClaim}, and it moves for many reasons at once — pricing, mix, headcount, one-off charges. It is consistent with ${row.company_name}'s claim; it is not evidence for it, and no part of this figure has been attributed to AI.`;
}

/* ------------------------------------------------------------------ */

export interface ClaimScale {
  /** The claim as a percentage of trailing four-quarter revenue. */
  sharePct: number;
  revenueUsd: number;
  fromDate: string;
  toDate: string;
}

/**
 * How big the claim is against the company's own revenue, which is the
 * fastest way to judge whether it could ever have been visible in a
 * margin. Straight division of two collected numbers — nothing modelled.
 */
export function claimScale(row: LedgerRow, revenue: Reading[] | undefined): ClaimScale | null {
  const claimed = row.claimed_amount_usd ?? 0;
  if (claimed <= 0 || !revenue || revenue.length === 0) return null;

  const at = [...revenue]
    .filter((p) => p.date <= row.claim_date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  if (at.length < 4) return null;

  const revenueUsd = at.reduce((s, p) => s + p.value, 0);
  if (revenueUsd <= 0) return null;

  return {
    sharePct: (claimed / revenueUsd) * 100,
    revenueUsd,
    fromDate: at[at.length - 1].date,
    toDate: at[0].date,
  };
}

/* ------------------------------------------------------------------ */

/** Short status text for a dense row, where the full sentence will not fit. */
export const STATUS_SHORT: Record<MeasureStatus, string> = {
  measured: 'Measured',
  too_soon: 'Too soon to measure',
  series_starts_late: 'Filings start after the claim',
  baseline_stale: 'No usable baseline',
  no_series: 'No filed margin series',
  not_a_filer: 'Not an SEC filer',
  not_a_company: 'Not a company claim',
};

/** How many of a set of claims could be measured at all. */
export function measuredCount(windows: MarginWindow[]): {
  measured: number;
  tooSoon: number;
  impossible: number;
} {
  let measured = 0;
  let tooSoon = 0;
  let impossible = 0;
  for (const w of windows) {
    if (w.status === 'measured') measured += 1;
    else if (w.status === 'too_soon' || w.status === 'series_starts_late') tooSoon += 1;
    else impossible += 1;
  }
  return { measured, tooSoon, impossible };
}
