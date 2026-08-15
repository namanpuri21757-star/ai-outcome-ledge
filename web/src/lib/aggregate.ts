import type { LedgerRow } from './types';
import { DESTINATION_ORDER, destination } from './labels';

/* ===================================================================
   THE SINGLE SOURCE OF TRUTH FOR EVERY MONEY FIGURE IN THIS APP.

   There is one function that adds dollars up — `totals` — and every
   figure on every screen is a field of what it returns, or a field of
   what it returns for a subset. Nothing else in `src/` may sum
   `claimed_amount_usd` or `traceable_to_pl_usd`; `test/aggregate.test.ts`
   asserts that by walking the tree.

   That rule exists because the previous build broke it. The flow diagram
   needed its own arithmetic to draw ribbons — gain rows with a positive
   claim, traced clamped to the claim — while the sidebar used a
   different sum over the same selection. Both were on screen at once,
   and they disagreed:

       headline   $8.39B claimed · $428M traceable · $7.96B not
       sidebar    $8.39B claimed · $451M traceable · $7.94B not

   The whole $23.1M difference is one row, `chegg-opex-cut-33pct`: a
   traced figure against a claim that was never stated in dollars. Two
   numbers for one quantity on one screen costs more credibility than
   either number buys.

   ── The denominator question ──────────────────────────────────────

   "What share of claimed dollars reaches a filing?" is a ratio, and a
   ratio needs its numerator and denominator to describe the same rows.
   A claim stated as "opex down 33%" contributes nothing to the
   denominator, so the dollars traced against it cannot go in the
   numerator either — that is the same category error as adding a $2T
   market capitalisation to a savings total.

   So `tracedUsd` is summed over the rows that carry a dollar claim, and
   the traced dollars sitting on claims with no dollar figure are
   reported separately as `tracedOutsideDenominator`. Both come out of
   this one function, so they can never be computed two ways again, and
   the interface shows the second whenever it is non-zero rather than
   quietly dropping it.
   =================================================================== */

export interface Totals {
  /** Every row in the set, of every kind. */
  rows: number;
  companies: number;

  /** Rows that assert an AI gain. Only these may touch a money total. */
  gainClaims: number;
  /** Gain claims carrying a figure in dollars. The denominator. */
  dollarClaims: number;
  /** Gain claims stated in something other than dollars. */
  nonDollarClaims: number;

  claimedUsd: number;
  tracedUsd: number;
  untracedUsd: number;
  /** tracedUsd / claimedUsd, as a percentage. Null when nothing is claimed. */
  tracedSharePct: number | null;

  /** Traced dollars on gain claims that named no dollar figure. */
  tracedOutsideDenominatorUsd: number;
  tracedOutsideDenominatorClaims: number;

  /**
   * Rows where the coded traceable figure exceeds the claim. Not
   * clamped away: if research says more was found than was claimed,
   * that is a defect to surface, not to hide behind a Math.min.
   */
  overTracedClaims: number;

  transferredUsd: number;
}

const EMPTY: Totals = {
  rows: 0,
  companies: 0,
  gainClaims: 0,
  dollarClaims: 0,
  nonDollarClaims: 0,
  claimedUsd: 0,
  tracedUsd: 0,
  untracedUsd: 0,
  tracedSharePct: null,
  tracedOutsideDenominatorUsd: 0,
  tracedOutsideDenominatorClaims: 0,
  overTracedClaims: 0,
  transferredUsd: 0,
};

/** A claim is in the denominator when it asserts a gain *and* names dollars. */
export function inDenominator(r: LedgerRow): boolean {
  return r.claim_kind === 'gain_claim' && (r.claimed_amount_usd ?? 0) > 0;
}

export function isGain(r: LedgerRow): boolean {
  return r.claim_kind === 'gain_claim';
}

export function totals(rows: LedgerRow[]): Totals {
  if (rows.length === 0) return { ...EMPTY };

  const t: Totals = { ...EMPTY };
  const companies = new Set<string>();

  for (const r of rows) {
    companies.add(r.company_slug);
    t.transferredUsd += r.transfer_amount_usd ?? 0;

    if (!isGain(r)) continue;
    t.gainClaims += 1;

    const claimed = r.claimed_amount_usd ?? 0;
    const traced = r.traceable_to_pl_usd ?? 0;

    if (claimed > 0) {
      t.dollarClaims += 1;
      t.claimedUsd += claimed;
      t.tracedUsd += traced;
      if (traced > claimed) t.overTracedClaims += 1;
    } else {
      t.nonDollarClaims += 1;
      if (traced !== 0) {
        t.tracedOutsideDenominatorUsd += traced;
        t.tracedOutsideDenominatorClaims += 1;
      }
    }
  }

  t.rows = rows.length;
  t.companies = companies.size;
  t.untracedUsd = t.claimedUsd - t.tracedUsd;
  t.tracedSharePct = t.claimedUsd > 0 ? (t.tracedUsd / t.claimedUsd) * 100 : null;
  return t;
}

/* ------------------------------------------------------------------ */

export interface Bucket<T> {
  key: T;
  rows: LedgerRow[];
  totals: Totals;
}

/**
 * Split rows and total each part with the same function that totals the
 * whole. The parts therefore sum to the whole by construction rather
 * than by care, which is the property `aggregate.test.ts` asserts.
 */
export function totalsBy<T extends string | number>(
  rows: LedgerRow[],
  pick: (r: LedgerRow) => T,
): Array<Bucket<T>> {
  const groups = new Map<T, LedgerRow[]>();
  for (const r of rows) {
    const k = pick(r);
    const list = groups.get(k);
    if (list) list.push(r);
    else groups.set(k, [r]);
  }
  return [...groups].map(([key, list]) => ({ key, rows: list, totals: totals(list) }));
}

/**
 * The five destinations plus "not coded", always all six, always in
 * `DESTINATION_ORDER`, including the ones with no rows — an empty
 * destination is a finding, not an absence.
 */
export function byDestination(rows: LedgerRow[]): Array<Bucket<number>> {
  const found = new Map<number, LedgerRow[]>();
  for (const r of rows) {
    const list = found.get(r.destination);
    if (list) list.push(r);
    else found.set(r.destination, [r]);
  }
  return DESTINATION_ORDER.map((rank) => {
    const list = found.get(rank) ?? [];
    return { key: rank, rows: list, totals: totals(list) };
  });
}

export function byKind(rows: LedgerRow[]): Array<Bucket<string>> {
  return totalsBy(rows, (r) => r.claim_kind).sort(
    (a, b) => b.totals.rows - a.totals.rows,
  );
}

/**
 * One scale for every reconciliation bar in the app, computed from the
 * whole corpus rather than from whatever is on screen — so a bar under a
 * filter stays comparable to the same bar without one.
 */
export function barMax(all: LedgerRow[]): number {
  let max = 1;
  for (const r of all) {
    if (!inDenominator(r)) continue;
    const claimed = r.claimed_amount_usd ?? 0;
    if (claimed > max) max = claimed;
  }
  return max;
}

/** The largest claimed total of any destination bucket, for the breakdown bars. */
export function destinationBarMax(all: LedgerRow[]): number {
  let max = 1;
  for (const b of byDestination(all)) {
    if (b.totals.claimedUsd > max) max = b.totals.claimedUsd;
  }
  return max;
}

/* ------------------------------------------------------------------ */

/**
 * The one sentence the whole project exists to say, assembled from the
 * rows so it cannot go stale. Returned as parts rather than a string so
 * the interface can typeset the percentage at display size.
 */
export interface Headline {
  /** "5.1" — null when the selection contains no dollar claim at all. */
  sharePct: number | null;
  claimedUsd: number;
  tracedUsd: number;
  untracedUsd: number;
  dollarClaims: number;
  gainClaims: number;
  /** Reads under the figure. Always a complete sentence. */
  sentence: string;
  /** Shown only when non-zero. Always a complete sentence. */
  asideSentence: string | null;
}

export function headline(rows: LedgerRow[], fmt: (n: number) => string): Headline {
  const t = totals(rows);

  const sentence =
    t.dollarClaims === 0
      ? t.gainClaims === 0
        ? 'No gain claim in this selection, so there is nothing to reconcile.'
        : `None of the ${t.gainClaims} gain ${plural(t.gainClaims, 'claim')} in this selection states a figure in dollars, so there is no percentage to give.`
      : `of the ${fmt(t.claimedUsd)} claimed across ${t.dollarClaims} gain ${plural(
          t.dollarClaims,
          'claim',
        )} can be matched to a named line item in a financial statement.`;

  const asideSentence =
    t.tracedOutsideDenominatorUsd !== 0
      ? `A further ${fmt(t.tracedOutsideDenominatorUsd)} is traceable on ${
          t.tracedOutsideDenominatorClaims
        } ${plural(t.tracedOutsideDenominatorClaims, 'claim')} that named no dollar figure, so it cannot enter the percentage.`
      : null;

  return {
    sharePct: t.tracedSharePct,
    claimedUsd: t.claimedUsd,
    tracedUsd: t.tracedUsd,
    untracedUsd: t.untracedUsd,
    dollarClaims: t.dollarClaims,
    gainClaims: t.gainClaims,
    sentence,
    asideSentence,
  };
}

export function plural(n: number, word: string, suffix = 's'): string {
  return n === 1 ? word : word + suffix;
}

/** "Absorbed as slack, kept as quality and taken from a supplier" */
export function listOf(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

/** Destination names for a set of rows, in ladder order, deduplicated. */
export function destinationNames(rows: LedgerRow[]): string[] {
  const ranks = new Set(rows.map((r) => r.destination));
  return DESTINATION_ORDER.filter((r) => ranks.has(r)).map((r) => destination(r).name);
}
