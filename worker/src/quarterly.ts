import type { XbrlFact, QuarterFact } from './types';

/**
 * Turning SEC XBRL duration facts into a clean quarterly series is the one
 * genuinely hard piece of this pipeline, and it is where a naive
 * implementation silently produces wrong numbers rather than errors.
 *
 * Three specific traps:
 *
 *  1. Amended filings. The same period appears more than once with different
 *     values. The later `filed` date wins, and a 10-K beats a 10-Q for the
 *     same window because the annual figure is the audited one.
 *
 *  2. Year-to-date tagging. Many filers tag Q2 as a 181-day period and Q3 as
 *     a 273-day period rather than tagging the discrete quarter. Reading those
 *     as quarters roughly doubles and triples the values.
 *
 *  3. Q4 is never filed. It only exists as FY minus the first three quarters.
 *
 * Everything here is pure. No fetch, no clock, no environment.
 */

const DAY_MS = 86_400_000;

export function daysBetween(startIso: string, endIso: string): number {
  const a = Date.parse(startIso + 'T00:00:00Z');
  const b = Date.parse(endIso + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / DAY_MS);
}

export type Bucket = 'Q' | 'H' | 'T' | 'FY' | 'other';

/** Classify a duration by length, with the tolerances the SEC itself uses for frames. */
export function bucketOf(days: number): Bucket {
  if (!Number.isFinite(days)) return 'other';
  if (days >= 80 && days <= 100) return 'Q';
  if (days >= 170 && days <= 200) return 'H';
  if (days >= 260 && days <= 290) return 'T';
  if (days >= 330 && days <= 400) return 'FY';
  return 'other';
}

/** Calendar-quarter label from a period end date. Filers with odd fiscal years
 *  still land in the calendar quarter their period ends in, which is what makes
 *  cross-company comparison possible at all. */
export function fiscalPeriodLabel(endIso: string): string {
  const [y, m] = endIso.split('-').map(Number);
  const q = Math.min(4, Math.floor((m - 1) / 3) + 1);
  return `CY${y}Q${q}`;
}

interface Keyed {
  start: string;
  end: string;
  val: number;
  bucket: Bucket;
  accn?: string;
  filed?: string;
  form?: string;
}

function formRank(form?: string): number {
  if (!form) return 0;
  if (form.startsWith('10-K') || form.startsWith('20-F') || form.startsWith('40-F')) return 2;
  if (form.startsWith('10-Q') || form.startsWith('6-K')) return 1;
  return 0;
}

/**
 * Collapse duplicate (start,end) pairs. Latest `filed` wins; when two filings
 * share a date, the annual form wins over the quarterly one.
 */
export function dedupeByPeriod(facts: XbrlFact[]): Keyed[] {
  const best = new Map<string, Keyed>();
  for (const f of facts) {
    if (!f.start || !f.end) continue;
    if (typeof f.val !== 'number' || !Number.isFinite(f.val)) continue;
    const key = `${f.start}|${f.end}`;
    const cand: Keyed = {
      start: f.start,
      end: f.end,
      val: f.val,
      bucket: bucketOf(daysBetween(f.start, f.end)),
      accn: f.accn,
      filed: f.filed,
      form: f.form,
    };
    const cur = best.get(key);
    if (!cur) {
      best.set(key, cand);
      continue;
    }
    const filedCmp = (cand.filed ?? '').localeCompare(cur.filed ?? '');
    if (filedCmp > 0 || (filedCmp === 0 && formRank(cand.form) > formRank(cur.form))) {
      best.set(key, cand);
    }
  }
  return [...best.values()];
}

function contains(outer: Keyed, inner: { start: string; end: string }): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

/**
 * Derive quarters that were never tagged discretely, by subtracting known
 * quarters from a longer cumulative period. Runs to a fixed point because
 * deriving Q2 from H1 can then unlock Q4 from FY.
 */
export function deriveQuarters(rows: Keyed[]): QuarterFact[] {
  const quarters = new Map<string, QuarterFact>();

  for (const r of rows) {
    if (r.bucket !== 'Q') continue;
    quarters.set(r.end, {
      end: r.end,
      start: r.start,
      val: r.val,
      origin: 'reported',
      accn: r.accn,
      fiscalPeriod: fiscalPeriodLabel(r.end),
    });
  }

  const cumulative = rows.filter((r) => r.bucket === 'H' || r.bucket === 'T' || r.bucket === 'FY');
  // Shorter windows first: solving H1 before FY means FY has more to subtract.
  cumulative.sort((a, b) => daysBetween(a.start, a.end) - daysBetween(b.start, b.end));

  const expected: Record<string, number> = { H: 2, T: 3, FY: 4 };

  for (let pass = 0; pass < 4; pass++) {
    let progress = false;

    for (const c of cumulative) {
      const inside = [...quarters.values()].filter((q) => contains(c, q));
      const need = expected[c.bucket];
      if (inside.length !== need - 1) continue;

      // The missing quarter must be a contiguous gap at one end of the window.
      inside.sort((a, b) => a.start.localeCompare(b.start));
      const covered = inside.reduce((s, q) => s + q.val, 0);
      const missingVal = c.val - covered;

      let start: string;
      let end: string;
      const last = inside[inside.length - 1];
      const first = inside[0];

      if (last.end < c.end) {
        start = addDays(last.end, 1);
        end = c.end;
      } else if (first.start > c.start) {
        start = c.start;
        end = addDays(first.start, -1);
      } else {
        // gap sits in the middle; ambiguous, refuse rather than guess
        continue;
      }

      const gapDays = daysBetween(start, end);
      if (bucketOf(gapDays) !== 'Q') continue;
      if (quarters.has(end)) continue;

      quarters.set(end, {
        end,
        start,
        val: round2(missingVal),
        origin: 'derived',
        accn: c.accn,
        fiscalPeriod: fiscalPeriodLabel(end),
      });
      progress = true;
    }

    if (!progress) break;
  }

  return [...quarters.values()].sort((a, b) => a.end.localeCompare(b.end));
}

export function addDays(iso: string, n: number): string {
  const t = Date.parse(iso + 'T00:00:00Z') + n * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The whole pipeline for one concept: dedupe, then derive. */
export function toQuarterlySeries(facts: XbrlFact[]): QuarterFact[] {
  return deriveQuarters(dedupeByPeriod(facts));
}

/**
 * Operating margin, joined on period end. Only emits a point where both
 * revenue and operating income exist for the identical period, and where
 * revenue is positive. A margin computed across mismatched periods is worse
 * than no margin at all, because it looks plausible.
 */
export function computeMarginSeries(
  revenue: QuarterFact[],
  operatingIncome: QuarterFact[],
): Array<{ end: string; value: number; fiscalPeriod: string }> {
  const rev = new Map(revenue.map((r) => [r.end, r]));
  const out: Array<{ end: string; value: number; fiscalPeriod: string }> = [];
  for (const oi of operatingIncome) {
    const r = rev.get(oi.end);
    if (!r || r.val <= 0) continue;
    out.push({
      end: oi.end,
      value: Math.round((oi.val / r.val) * 1e6) / 1e6,
      fiscalPeriod: oi.fiscalPeriod,
    });
  }
  return out.sort((a, b) => a.end.localeCompare(b.end));
}
