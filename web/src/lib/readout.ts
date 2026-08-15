import type { LedgerRow } from './types';
import { byDestination, listOf, plural, totals } from './aggregate';
import { destination } from './labels';
import type { Filters } from './filters';

/* ===================================================================
   What the numbers say, generated from the numbers.

   Four statements under the headline, each one a sentence a reader can
   check against the rows it names, and each one carrying the selection
   that produces those rows. Nothing here is typed prose about the data:
   every figure in every sentence is computed from the argument, so a
   changed row changes the sentence rather than silently contradicting
   it.

   Every statement must survive an empty selection and say so plainly
   rather than rendering a sentence made out of zeroes.
   =================================================================== */

export interface ReadoutItem {
  id: string;
  /** The heading, phrased as the question a reader is asking. */
  question: string;
  /** The answer. A complete sentence, always. */
  answer: string;
  /**
   * How many rows `select` returns — not how many the sentence talks
   * about. Those can differ: a statement may span two dimensions that
   * the filter can only AND together. When they differ, `selectLabel`
   * says what the button will actually show, so the offer is never
   * larger than what arrives.
   */
  rowCount: number;
  /** The selection that shows exactly `rowCount` rows. */
  select: Partial<Filters> | null;
  /** What the button offers, when that is narrower than the sentence. */
  selectLabel: string | null;
}

export function readout(rows: LedgerRow[], fmtUsd: (n: number) => string): ReadoutItem[] {
  return [
    whereItLanded(rows, fmtUsd),
    reachedMargin(rows, fmtUsd),
    contradicted(rows, fmtUsd),
    uninterpretable(rows, fmtUsd),
  ];
}

/* ------------------------------------------------------------------ */

function whereItLanded(rows: LedgerRow[], fmtUsd: (n: number) => string): ReadoutItem {
  const question = 'If the money is not in a filing, where did it go?';
  const buckets = byDestination(rows).filter((b) => b.totals.gainClaims > 0);

  if (buckets.length === 0) {
    return {
      id: 'landed',
      question,
      answer: 'No gain claim is in this selection, so there is nothing to place.',
      rowCount: 0,
      select: null,
      selectLabel: null,
    };
  }

  const ranked = [...buckets].sort(
    (a, b) => b.totals.claimedUsd - a.totals.claimedUsd || b.totals.gainClaims - a.totals.gainClaims,
  );
  const top = ranked[0];
  const d = destination(top.key);
  const t = totals(rows);

  const share =
    t.claimedUsd > 0 && top.totals.claimedUsd > 0
      ? ` — ${Math.round((top.totals.claimedUsd / t.claimedUsd) * 100)}% of every claimed dollar in this selection`
      : '';

  const answer =
    top.totals.claimedUsd > 0
      ? `The largest single destination is “${d.name}”: ${top.totals.gainClaims} gain ${plural(
          top.totals.gainClaims,
          'claim',
        )} carrying ${fmtUsd(top.totals.claimedUsd)}${share}. ${d.meaning}`
      : `The largest single destination by row count is “${d.name}”, with ${top.totals.gainClaims} gain ${plural(
          top.totals.gainClaims,
          'claim',
        )} and no dollar figure between them. ${d.meaning}`;

  return {
    id: 'landed',
    question,
    answer,
    // The selection is gain claims in this destination, so the count
    // offered is gain claims in this destination — not every row in it.
    rowCount: top.totals.gainClaims,
    select: { destinations: [top.key], kinds: ['gain_claim'] },
    selectLabel: null,
  };
}

function reachedMargin(rows: LedgerRow[], fmtUsd: (n: number) => string): ReadoutItem {
  const question = 'Did anything actually reach profit?';
  const kept = rows.filter((r) => r.claim_kind === 'gain_claim' && r.destination === 5);
  const t = totals(kept);

  if (kept.length === 0) {
    return {
      id: 'margin',
      question,
      answer:
        'Not one gain claim in this selection is coded as kept as margin. That is the finding, not a gap in the data.',
      rowCount: 0,
      select: null,
      selectLabel: null,
    };
  }

  const companies = new Set(kept.map((r) => r.company_name));
  const traced = t.tracedUsd > 0
    ? `${fmtUsd(t.tracedUsd)} of it reaches a filing line.`
    : 'None of it reaches a filing line, so the coding rests on the claim rather than on a disclosure.';

  return {
    id: 'margin',
    question,
    answer: `${kept.length} gain ${plural(kept.length, 'claim')} across ${companies.size} ${
      companies.size === 1 ? 'company' : 'companies'
    } ${kept.length === 1 ? 'is' : 'are'} coded as kept as margin, carrying ${fmtUsd(
      t.claimedUsd,
    )}. ${traced}`,
    rowCount: kept.length,
    select: { destinations: [5], kinds: ['gain_claim'] },
    selectLabel: null,
  };
}

function contradicted(rows: LedgerRow[], fmtUsd: (n: number) => string): ReadoutItem {
  const question = 'Where does the claim disagree with the filing?';
  const counters = rows.filter((r) => r.claim_kind === 'counter_evidence');
  const withMove = rows.filter((r) => r.observed_counter_move);

  if (counters.length === 0 && withMove.length === 0) {
    return {
      id: 'contradicted',
      question,
      answer: 'Nothing in this selection records a movement that runs against a claim.',
      rowCount: 0,
      select: null,
      selectLabel: null,
    };
  }

  const companies = new Set([...counters, ...withMove].map((r) => r.company_name));
  const against = totals(withMove);
  const money = against.claimedUsd > 0
    ? ` The gain claims carrying an observed counter-movement total ${fmtUsd(against.claimedUsd)}.`
    : '';

  return {
    id: 'contradicted',
    question,
    answer: `${counters.length} ${plural(
      counters.length,
      'row',
    )} record an observation that bounds or contradicts a gain claim, across ${companies.size} ${
      companies.size === 1 ? 'company' : 'companies'
    } — a cost line that rose, headcount that grew, or a margin that did not expand.${money}`,
    rowCount: counters.length,
    select: { kinds: ['counter_evidence'] },
    selectLabel: null,
  };
}

function uninterpretable(rows: LedgerRow[], fmtUsd: (n: number) => string): ReadoutItem {
  const question = 'Which numbers cannot be checked at all?';
  const hits = rows.filter(
    (r) => r.measurement_basis === 'unverified' || r.verification_status === 'disputed',
  );

  if (hits.length === 0) {
    return {
      id: 'uninterpretable',
      question,
      answer:
        'Every row in this selection has a stated measurement basis and an undisputed source.',
      rowCount: 0,
      select: null,
      selectLabel: null,
    };
  }

  const t = totals(hits);
  const money = t.claimedUsd > 0
    ? ` Between them they carry ${fmtUsd(t.claimedUsd)} of claimed value that cannot currently be interpreted.`
    : ' None of them names a dollar figure.';

  // The statement spans two dimensions — an undefined measurement basis
  // and a disputed source — and a filter can only AND them together. So
  // the button offers the larger of the two subsets and says which one,
  // rather than promising a count it cannot produce.
  const undefinedBasis = rows.filter((r) => r.measurement_basis === 'unverified');
  const disputed = rows.filter((r) => r.verification_status === 'disputed');
  const offerBasis = undefinedBasis.length >= disputed.length;
  const offered = offerBasis ? undefinedBasis : disputed;
  const partial = offered.length < hits.length;

  return {
    id: 'uninterpretable',
    question,
    answer: `${hits.length} ${plural(
      hits.length,
      'row',
    )} either never say what the number counts, or have sources that conflict.${money} Each carries the next step needed to settle it.`,
    rowCount: offered.length,
    select: offerBasis ? { bases: ['unverified'] } : { verification: ['disputed'] },
    selectLabel: partial
      ? offerBasis
        ? 'whose measurement basis is undefined'
        : 'whose sources conflict'
      : null,
  };
}

/* ------------------------------------------------------------------ */

/**
 * The standing caveat about the corpus itself, generated so the counts
 * cannot drift from the rows. Shown once, under the readout.
 */
export function corpusNote(all: LedgerRow[], fmtUsd: (n: number) => string): string {
  const t = totals(all);
  const research = all.filter((r) => r.claim_kind === 'research_finding').length;
  const parts: string[] = [];

  parts.push(
    `${t.rows} ${plural(t.rows, 'row')} across ${t.companies} ${
      t.companies === 1 ? 'company' : 'companies and research populations'
    }, hand-coded.`,
  );
  parts.push(
    `${t.gainClaims} of them assert a gain, and ${t.dollarClaims} of those name a figure in dollars totalling ${fmtUsd(
      t.claimedUsd,
    )} — the only rows that enter a money total here.`,
  );
  if (research > 0) {
    parts.push(
      `${research} ${plural(research, 'row')} are population-level research rather than a company claim, and are the counterweight to the rest.`,
    );
  }
  return parts.join(' ');
}

/** Destination names present in a set, in ladder order. */
export function landedIn(rows: LedgerRow[]): string {
  const gains = rows.filter((r) => r.claim_kind === 'gain_claim');
  if (gains.length === 0) return '';
  const ranks = byDestination(gains).filter((b) => b.rows.length > 0);
  return listOf(ranks.map((b) => destination(b.key).name.toLowerCase()));
}
