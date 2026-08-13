import type { LedgerRow } from './types';
import type { Filters } from './filters';
import { EMPTY_FILTERS, conditionCells } from './filters';
import { buildProfiles, type CompanyProfile } from './companies';
import { destination, group, CONDITIONS } from './labels';
import { usd, bps } from './format';

/* ===================================================================
   FINDINGS

   The old front door was a filter wall: it offered dimensions and
   expected you to already know the coding scheme. This offers the
   questions instead.

   Two rules hold this honest:

   1. Nothing here is typed prose about the data. Every sentence is
      assembled from the rows on each render, so a recoded row or a
      fresh collector run changes the answer rather than leaving a
      stale paragraph behind.

   2. When a query returns nothing, the finding says so plainly. It
      never falls back to copy that describes data that is not there.

   Each finding also carries the filter that produced it, so opening
   one teaches the filter system by demonstration.
   =================================================================== */

export interface FindingEntry {
  slug: string;
  name: string;
  /** The number that ranks this entry, already formatted. */
  figure: string;
  /** Why this company is in this answer. Derived from its own rows. */
  why: string;
}

export interface FindingResult {
  /** Generated. One or two sentences stating what the rows show. */
  answer: string;
  stats: Array<{ label: string; value: string; tone?: 'gap' | 'traced' | 'plain' }>;
  entries: FindingEntry[];
  /** Set when the query matched nothing. The finding renders this instead. */
  empty: string | null;
}

export interface Finding {
  id: string;
  question: string;
  /** Why this question is worth asking, in one line. */
  premise: string;
  /** The filter state that reproduces this answer in the ledger. */
  filter: Filters;
  run: (rows: LedgerRow[]) => FindingResult;
}

const f = (patch: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...patch });

const NONE: FindingResult = { answer: '', stats: [], entries: [], empty: 'No rows match.' };

function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}

/* ------------------------------------------------------------------ */

export const FINDINGS: Finding[] = [
  {
    id: 'slack',
    question: 'Who is spending heavily and seeing the efficiency turn into slack?',
    premise:
      'A gain absorbed as slack is real work that got faster and money that never moved. It is the most common outcome in the ledger and the hardest to see from the outside.',
    filter: f({ destinations: [1], kinds: ['gain_claim'] }),
    run: (rows) => {
      const hits = rows.filter((r) => r.destination === 1 && r.claim_kind === 'gain_claim');
      if (!hits.length) return { ...NONE, empty: 'No gain claims are currently coded as absorbed slack.' };

      const profiles = buildProfiles(hits);
      const claimed = sum(hits.map((r) => r.claimed_amount_usd));
      const traced = sum(hits.map((r) => r.traceable_to_pl_usd));
      const withDollars = hits.filter((r) => r.claimed_amount_usd);

      return {
        answer:
          `${plural(hits.length, 'gain claim')} across ${plural(profiles.length, 'company', 'companies')} were absorbed as slack. ` +
          `${plural(withDollars.length, 'of them carries', 'of them carry')} a dollar figure, totalling ${usd(claimed)}, ` +
          (traced > 0
            ? `of which ${usd(traced)} reaches a disclosed line item.`
            : 'and none of it reaches a disclosed line item.'),
        stats: [
          { label: 'Claimed', value: usd(claimed) },
          { label: 'Reached a filing line', value: usd(traced), tone: traced > 0 ? 'traced' : 'gap' },
          { label: 'Companies', value: String(profiles.length) },
        ],
        entries: profiles.slice(0, 12).map((p) => ({
          slug: p.slug,
          name: p.name,
          figure: p.claimedUsd > 0 ? usd(p.claimedUsd) : `${plural(p.rows.length, 'row')}`,
          why: whySlack(p),
        })),
        empty: null,
      };
    },
  },

  {
    id: 'margin',
    question: 'Who actually converted spending into margin — and are they AI-native or large incumbents?',
    premise:
      'Retaining a gain as profit needs all three conditions at once. This is the list of firms whose rows are coded that way, split by what kind of company they are.',
    filter: f({ destinations: [5], kinds: ['gain_claim'] }),
    run: (rows) => {
      const hits = rows.filter((r) => r.destination === 5 && r.claim_kind === 'gain_claim');
      if (!hits.length) return { ...NONE, empty: 'No gain claims are currently coded as kept margin.' };

      const profiles = buildProfiles(hits);
      const byGroup = new Map<string, number>();
      for (const p of profiles) {
        const key = p.groupCode ?? '?';
        byGroup.set(key, (byGroup.get(key) ?? 0) + 1);
      }
      const ranked = [...byGroup.entries()].sort((a, b) => b[1] - a[1]);
      const shape = ranked
        .slice(0, 3)
        .map(([code, n]) => `${group(code).name.toLowerCase()} (${n})`)
        .join(', ');

      const measured = profiles.filter((p) => p.marginDelta4qBps !== null);
      const positive = measured.filter((p) => (p.marginDelta4qBps ?? 0) > 0);

      return {
        answer:
          `${plural(profiles.length, 'company', 'companies')} have at least one gain coded as kept margin. ` +
          `By type they are ${shape}. ` +
          (measured.length === 0
            ? 'None of them yet has a measured margin movement in the filing data, so the coding is untested against the filings.'
            : `${measured.length} of them have a measured operating-margin movement a year on, and ${positive.length} of those moved wider.`),
        stats: [
          { label: 'Companies', value: String(profiles.length) },
          { label: 'Claimed', value: usd(sum(hits.map((r) => r.claimed_amount_usd))) },
          {
            label: 'Margin measured',
            value: `${measured.length} of ${profiles.length}`,
            tone: measured.length ? 'plain' : 'gap',
          },
        ],
        entries: profiles.slice(0, 12).map((p) => ({
          slug: p.slug,
          name: p.name,
          figure:
            p.marginDelta4qBps !== null
              ? bps(p.marginDelta4qBps)
              : p.claimedUsd > 0
                ? usd(p.claimedUsd)
                : plural(p.rows.length, 'row'),
          why: whyMargin(p),
        })),
        empty: null,
      };
    },
  },

  {
    id: 'transfer',
    question: 'Whose revenue line actually paid for these savings?',
    premise:
      "When a buyer removes an outsourced function, the saving is a supplier's revenue decline. It is a transfer between two firms, and in aggregate it nets to roughly nothing.",
    filter: f({ counterpartyOnly: true }),
    run: (rows) => {
      const hits = rows.filter((r) => r.counterparty_absorbed);
      if (!hits.length) return { ...NONE, empty: 'No rows currently record a supplier absorbing the loss.' };

      const named = hits.filter((r) => r.counterparty_slug);
      const amount = sum(hits.map((r) => r.transfer_amount_usd));
      const profiles = buildProfiles(hits);

      return {
        answer:
          `${plural(hits.length, 'row')} record a saving that came off somebody else's revenue line. ` +
          `${named.length} of them name the supplier; ${hits.length - named.length} do not, because nobody has established who paid. ` +
          (amount > 0
            ? `Where an amount has been identified it totals ${usd(amount)}.`
            : 'No amount has been identified on any of them.'),
        stats: [
          { label: 'Rows', value: String(hits.length) },
          { label: 'Supplier named', value: `${named.length} of ${hits.length}` },
          { label: 'Amount identified', value: usd(amount), tone: 'plain' },
        ],
        entries: profiles.slice(0, 12).map((p) => ({
          slug: p.slug,
          name: p.name,
          figure: p.counterparties[0]?.amountUsd ? usd(p.counterparties[0].amountUsd) : plural(p.rows.length, 'row'),
          why: whyTransfer(p),
        })),
        empty: null,
      };
    },
  },

  {
    id: 'contradicted',
    question: 'Where does the claim disagree with the filing?',
    premise:
      'These are the rows where a saving was announced and a number in the same company moved the other way. The most useful rows in the ledger, and the hardest to assemble by hand.',
    filter: f({ search: '' }),
    run: (rows) => {
      const hits = rows.filter((r) => !!r.observed_counter_move);
      if (!hits.length) return { ...NONE, empty: 'No rows currently record a countervailing movement.' };

      const profiles = buildProfiles(hits);
      const claimed = sum(hits.filter((r) => r.claim_kind === 'gain_claim').map((r) => r.claimed_amount_usd));

      return {
        answer:
          `${plural(hits.length, 'row')} across ${plural(profiles.length, 'company', 'companies')} carry an observation that runs against the claim — ` +
          'a cost line that rose, headcount that grew, a margin that did not expand. ' +
          (claimed > 0 ? `The gain claims among them total ${usd(claimed)}.` : ''),
        stats: [
          { label: 'Rows', value: String(hits.length) },
          { label: 'Companies', value: String(profiles.length) },
          { label: 'Claimed against', value: usd(claimed), tone: 'gap' },
        ],
        entries: profiles.slice(0, 12).map((p) => ({
          slug: p.slug,
          name: p.name,
          figure: p.claimedUsd > 0 ? usd(p.claimedUsd) : plural(p.rows.length, 'row'),
          why:
            p.rows.find((r) => r.observed_counter_move)?.observed_counter_move ??
            'A countervailing observation is recorded on this company.',
        })),
        empty: null,
      };
    },
  },

  {
    id: 'undefined',
    question: 'Which claims cannot be checked at all?',
    premise:
      'A number whose source never says what it counts cannot be reconciled, argued with, or repeated safely. Knowing which ones these are is worth more than the numbers themselves.',
    filter: f({ bases: ['unverified'] }),
    run: (rows) => {
      const hits = rows.filter(
        (r) => r.measurement_basis === 'unverified' || r.verification_status === 'disputed',
      );
      if (!hits.length) return { ...NONE, empty: 'Every row currently has a defined measurement basis.' };

      const profiles = buildProfiles(hits);
      const money = sum(hits.map((r) => r.claimed_amount_usd));

      return {
        answer:
          `${plural(hits.length, 'row')} either have no stated measurement basis or have sources that conflict. ` +
          (money > 0
            ? `Between them they carry ${usd(money)} of claimed value that cannot currently be interpreted.`
            : 'None of them carries a dollar figure.'),
        stats: [
          { label: 'Rows', value: String(hits.length) },
          { label: 'Uninterpretable value', value: usd(money), tone: 'gap' },
          { label: 'Companies', value: String(profiles.length) },
        ],
        entries: profiles.slice(0, 12).map((p) => ({
          slug: p.slug,
          name: p.name,
          figure: p.claimedUsd > 0 ? usd(p.claimedUsd) : plural(p.rows.length, 'row'),
          why:
            p.rows.find((r) => r.verify_hint)?.verify_hint ??
            'The source does not define what the number counts.',
        })),
        empty: null,
      };
    },
  },

  {
    id: 'conditions',
    question: 'Does meeting all three conditions actually produce margin?',
    premise:
      'The hypothesis is that two of three gets operational improvement and no profit, and three of three is what the rare high performers have. This tests it against the filing data rather than restating it.',
    filter: f({}),
    run: (rows) => {
      const cells = conditionCells(rows).filter((c) => c.rows.length > 0);
      if (!cells.length) {
        return { ...NONE, empty: 'No rows have all three conditions coded yet.' };
      }

      const full = cells.filter((c) => c.passes === 3);
      const partial = cells.filter((c) => c.passes < 3);
      const measuredFull = full.reduce((a, c) => a + c.measured, 0);
      const measuredPartial = partial.reduce((a, c) => a + c.measured, 0);

      const fullRows = full.reduce((a, c) => a + c.rows.length, 0);
      const partialRows = partial.reduce((a, c) => a + c.rows.length, 0);

      const answer =
        measuredFull === 0 && measuredPartial === 0
          ? `${plural(fullRows, 'row')} meet all three conditions and ${plural(partialRows, 'row')} meet fewer. ` +
            'No margin movement has been measured on any of them yet, so the hypothesis is stated here but not yet tested. ' +
            'It becomes testable the moment the collector populates the outcome series.'
          : `${plural(fullRows, 'row')} meet all three conditions and ${plural(partialRows, 'row')} meet fewer. ` +
            `Margin movement is measured on ${measuredFull} of the first group and ${measuredPartial} of the second.` +
            (measuredFull > 0
              ? ` Mean movement where all three are met: ${bps(meanOf(full))}.`
              : '');

      return {
        answer,
        stats: [
          { label: 'All three met', value: String(fullRows) },
          { label: 'Fewer than three', value: String(partialRows) },
          {
            label: 'Margin measured',
            value: String(measuredFull + measuredPartial),
            tone: measuredFull + measuredPartial ? 'plain' : 'gap',
          },
        ],
        entries: full
          .flatMap((c) => c.rows)
          .slice(0, 12)
          .map((r) => ({
            slug: r.company_slug,
            name: r.company_name,
            figure: r.margin_delta_4q_bps !== null ? bps(r.margin_delta_4q_bps) : usd(r.claimed_amount_usd),
            why: r.conditions_note ?? r.destination_rationale ?? 'All three conditions coded as met.',
          })),
        empty: null,
      };
    },
  },
];

export function findingById(id: string): Finding | null {
  return FINDINGS.find((x) => x.id === id) ?? null;
}

/* ---------------- per-company reasons ---------------- */

function whySlack(p: CompanyProfile): string {
  const row = p.rows.find((r) => r.destination === 1);
  if (row?.destination_rationale) return row.destination_rationale;
  if (row?.observed_counter_move) return row.observed_counter_move;
  const failed = failedConditions(p);
  if (failed.length) return `Fails ${listOf(failed)}.`;
  return 'Freed capacity stayed inside the business.';
}

function whyMargin(p: CompanyProfile): string {
  const row = p.rows.find((r) => r.destination === 5);
  if (row?.destination_rationale) return row.destination_rationale;
  if (p.conditionsPassed === 3) return 'All three conditions coded as met.';
  return `${group(p.groupCode).name}. ${group(p.groupCode).blurb}`;
}

function whyTransfer(p: CompanyProfile): string {
  const cp = p.counterparties[0];
  const row = p.rows.find((r) => r.counterparty_absorbed);
  if (cp && cp.slug) return `Absorbed by ${cp.name}.`;
  if (row?.counterparty_note) return row.counterparty_note;
  return 'A supplier absorbed the loss, but nobody has established which one.';
}

/** The conditions this company is coded as failing, in plain words. */
export function failedConditions(p: CompanyProfile): string[] {
  const out: string[] = [];
  if (p.conditions.billing === false) out.push(CONDITIONS.billing.name.toLowerCase());
  if (p.conditions.sink === false) out.push(CONDITIONS.sink.name.toLowerCase());
  if (p.conditions.permission === false) out.push(CONDITIONS.permission.name.toLowerCase());
  return out;
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function meanOf(cells: Array<{ rows: Array<{ margin_delta_4q_bps: number | null }> }>): number | null {
  const vals = cells
    .flatMap((c) => c.rows.map((r) => r.margin_delta_4q_bps))
    .filter((v): v is number => v !== null && v !== undefined);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function sum(xs: Array<number | null>): number {
  return xs.reduce<number>((a, b) => a + (b ?? 0), 0);
}

export { listOf };
