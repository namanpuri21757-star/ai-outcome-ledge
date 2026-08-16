import { byDestination, inDenominator, isGain, totals } from './aggregate';
import { buildProfiles, type CompanyProfile } from './companies';
import { basis, destination, type DefinitionKind } from './labels';
import type { LedgerRow } from './types';

/* ===================================================================
   What the two cover pages are made of.

   Both of them are arguments rather than tables, and an argument about
   numbers goes stale the moment somebody types one into it. So the
   blueprint's four stages and the directory's cards are derived here,
   from the rows, with every figure coming through `totals()` or a
   bucket of it — never a second piece of arithmetic.

   Nothing in this file formats money. The stages carry raw numbers and
   the view formats them with `usd()`, so there is one way to write a
   dollar amount in this app and it is the one in `lib/format.ts`.
   =================================================================== */

export interface Stage {
  key: string;
  /** The mark on the drawing, so a reader can point at one. */
  mark: string;
  /** What happens at this stage, in the reader's words. */
  title: string;
  /** The vocabulary entry behind it. Nothing here is a new definition. */
  term: { kind: DefinitionKind; code: string };
  /** The live figure, already reduced to a number by `totals()`. */
  value: { usd: number } | { count: number } | { pct: number | null };
  /** What that figure counts. Assembled, never typed. */
  caption: string;
  /** The one sentence this stage adds to the argument. */
  reads: string;
}

/**
 * The four stages a claimed dollar passes through, and where the corpus
 * says most of them stop.
 */
export function blueprint(rows: LedgerRow[]): Stage[] {
  const t = totals(rows);
  const dollarRows = rows.filter(inDenominator);
  const softRows = dollarRows.filter((r) => basis(r.measurement_basis).soft);

  // The destination that holds the most claimed money, ignoring the
  // uncoded bucket — the one place the ladder actually piles up.
  const ranked = byDestination(rows)
    .filter((b) => b.key !== 0)
    .sort((a, b) => b.totals.claimedUsd - a.totals.claimedUsd);
  // byDestination always returns all six buckets, empty ones included, so
  // the largest of them can still be worth nothing. A destination holding
  // no dollars is not the destination the money went to.
  const top = ranked[0] && ranked[0].totals.claimedUsd > 0 ? ranked[0] : null;

  return [
    {
      key: 'claimed',
      mark: 'A1',
      title: 'Someone states a number',
      term: { kind: 'phrase', code: 'claimed' },
      value: { usd: t.claimedUsd },
      caption: `${t.dollarClaims} gain claims naming dollars, across ${t.companies} companies and research populations`,
      reads: 'A press release, an earnings call, a case study. The figure enters the world already rounded.',
    },
    {
      key: 'measured',
      mark: 'B2',
      title: 'The source says what it counted',
      term: { kind: 'phrase', code: 'basis' },
      value: { count: softRows.length },
      caption: `of those ${dollarRows.length} claims count something other than a cost line that moved`,
      reads: 'Hours freed, tickets deflected, time saved. Real measurements, and not money leaving the business.',
    },
    {
      key: 'landed',
      mark: 'C3',
      title: 'The gain lands somewhere',
      term: { kind: 'phrase', code: 'destination' },
      value: { usd: top?.totals.claimedUsd ?? 0 },
      caption: top
        ? `sits in one destination — ${destination(top.key).verb} — over ${top.totals.gainClaims} gain claims`
        : 'no destination carries a dollar figure yet',
      reads: 'Freed capacity has five places to go, and only the last of them is profit.',
    },
    {
      key: 'traceable',
      mark: 'D4',
      title: 'It reaches a filing, or it does not',
      term: { kind: 'phrase', code: 'traceable' },
      value: { pct: t.tracedSharePct },
      caption: `of the claimed dollars can be matched to a named line item`,
      reads: 'This is the number the project exists to keep. It is not an accusation, and it is not a rounding error.',
    },
  ];
}

/* ------------------------------------------------------------------ */

export interface DirectoryCard {
  profile: CompanyProfile;
  /** The claim that speaks for the company: the largest, else the first. */
  lead: LedgerRow | null;
}

/**
 * One card per company in the corpus, biggest claim first, and every one
 * of them a company that is actually coded. A company with no dollar
 * claim keeps its card and says so — an empty figure is a finding.
 */
export function directoryCards(rows: LedgerRow[]): DirectoryCard[] {
  return buildProfiles(rows)
    .map((profile) => ({ profile, lead: leadClaim(profile) }))
    .sort((a, b) => {
      const d = b.profile.totals.claimedUsd - a.profile.totals.claimedUsd;
      if (d !== 0) return d;
      const r = b.profile.totals.rows - a.profile.totals.rows;
      if (r !== 0) return r;
      return a.profile.name.localeCompare(b.profile.name);
    });
}

/**
 * One scale for every bar on the directory, and it is a company scale.
 * `barMax()` is the largest single claim, which is the right scale for a
 * row of the ledger and the wrong one here: a company that claims more
 * in total than any one claim would draw a bar wider than its own card.
 * The ledger's own company list computes the same thing the same way.
 */
export function directoryBarMax(cards: DirectoryCard[]): number {
  return Math.max(...cards.map((c) => c.profile.totals.claimedUsd), 1);
}

function leadClaim(profile: CompanyProfile): LedgerRow | null {
  const gains = profile.rows.filter(isGain);
  const pool = gains.length ? gains : profile.rows;
  // A plain scan rather than a fold: this picks one row, it does not add
  // any up, and `aggregate.ts` stays the only place that adds money up.
  let best: LedgerRow | null = null;
  for (const r of pool) {
    if (best === null || (r.claimed_amount_usd ?? 0) > (best.claimed_amount_usd ?? 0)) best = r;
  }
  return best;
}
