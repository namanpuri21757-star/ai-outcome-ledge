import type { LedgerRow } from './types';
import { totals, listOf, plural, type Totals } from './aggregate';
import { CONDITION_LIST, DESTINATION_ORDER, destination, group } from './labels';
import type { ConditionKey } from './labels';

/* ===================================================================
   One company, everything the ledger records about it.

   CLAUDE.md's output test is that a reader can "name specific companies
   whose AI gains did or did not reach profit, and say why". `verdict()`
   is that sentence, assembled from the rows at render time. It is never
   typed, because a typed sentence about the data goes stale silently and
   this is a project about numbers being checkable.
   =================================================================== */

export interface CompanyProfile {
  slug: string;
  name: string;
  ticker: string | null;
  sector: string | null;
  groupCode: string | null;
  groupName: string;
  isPublic: boolean;

  rows: LedgerRow[];
  gains: LedgerRow[];
  counterEvidence: LedgerRow[];

  totals: Totals;

  destinationMix: Array<{ rank: number; rows: number; claimedUsd: number }>;
  /** The destination most of this company's gain claims landed in. */
  dominantDestination: number | null;

  conditions: Record<ConditionKey, boolean | null>;
  /** 0–3, or null when any of the three is uncoded. */
  conditionsPassed: number | null;

  firstClaim: string | null;
  lastClaim: string | null;

  /** Suppliers this company's savings came off, where one is named. */
  counterparties: Array<{ slug: string | null; name: string; rows: number; amountUsd: number }>;
  /** The reverse index: companies whose savings landed on this one. */
  absorbedFrom: Array<{ slug: string; name: string; rows: number; amountUsd: number }>;
}

const CONDITION_FIELD: Record<ConditionKey, keyof LedgerRow> = {
  billing: 'cond_billing_unit_survives',
  sink: 'cond_demand_sink',
  permission: 'cond_permission_to_act',
};

/** Null unless every coded value agrees. An uncoded value is not a `false`. */
export function unanimous(values: Array<boolean | null>): boolean | null {
  const coded = values.filter((v): v is boolean => v !== null && v !== undefined);
  if (coded.length === 0) return null;
  return coded.every((v) => v === coded[0]) ? coded[0] : null;
}

export function buildProfiles(rows: LedgerRow[]): CompanyProfile[] {
  const bySlug = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    const list = bySlug.get(r.company_slug);
    if (list) list.push(r);
    else bySlug.set(r.company_slug, [r]);
  }

  const profiles: CompanyProfile[] = [];

  for (const [slug, list] of bySlug) {
    const head = list[0];
    const gains = list.filter((r) => r.claim_kind === 'gain_claim');
    const t = totals(list);

    const mix = new Map<number, { rows: number; claimedUsd: number }>();
    for (const r of gains) {
      const at = mix.get(r.destination) ?? { rows: 0, claimedUsd: 0 };
      at.rows += 1;
      at.claimedUsd += r.claimed_amount_usd ?? 0;
      mix.set(r.destination, at);
    }
    const destinationMix = DESTINATION_ORDER.filter((d) => mix.has(d)).map((rank) => ({
      rank,
      ...mix.get(rank)!,
    }));

    // The destination carrying the most gain rows; dollars break a tie,
    // because a company with one big claim and three small ones is
    // characterised by where the three went.
    const dominantDestination =
      destinationMix.length === 0
        ? null
        : [...destinationMix].sort(
            (a, b) => b.rows - a.rows || b.claimedUsd - a.claimedUsd,
          )[0].rank;

    const conditions = Object.fromEntries(
      CONDITION_LIST.map((c) => [
        c.key,
        unanimous(list.map((r) => r[CONDITION_FIELD[c.key]] as boolean | null)),
      ]),
    ) as Record<ConditionKey, boolean | null>;

    const values = CONDITION_LIST.map((c) => conditions[c.key]);
    const conditionsPassed = values.some((v) => v === null)
      ? null
      : values.filter((v) => v === true).length;

    const dates = list.map((r) => r.claim_date).sort();

    const cpMap = new Map<string, { slug: string | null; name: string; rows: number; amountUsd: number }>();
    for (const r of list) {
      if (!r.counterparty_absorbed) continue;
      const key = r.counterparty_slug ?? '__unnamed';
      const at = cpMap.get(key) ?? {
        slug: r.counterparty_slug,
        name: r.counterparty_name ?? 'Not established',
        rows: 0,
        amountUsd: 0,
      };
      at.rows += 1;
      at.amountUsd += r.transfer_amount_usd ?? 0;
      cpMap.set(key, at);
    }

    profiles.push({
      slug,
      name: head.company_name,
      ticker: head.company_ticker,
      sector: head.sector,
      groupCode: head.group_code,
      groupName: group(head.group_code).name,
      isPublic: head.company_is_public,
      rows: [...list].sort((a, b) => b.claim_date.localeCompare(a.claim_date)),
      gains,
      counterEvidence: list.filter((r) => r.claim_kind === 'counter_evidence'),
      totals: t,
      destinationMix,
      dominantDestination,
      conditions,
      conditionsPassed,
      firstClaim: dates[0] ?? null,
      lastClaim: dates[dates.length - 1] ?? null,
      counterparties: [...cpMap.values()],
      absorbedFrom: [],
    });
  }

  // The reverse index: who took money off whom.
  const byName = new Map(profiles.map((p) => [p.slug, p]));
  for (const p of profiles) {
    for (const cp of p.counterparties) {
      if (!cp.slug) continue;
      const target = byName.get(cp.slug);
      if (!target) continue;
      target.absorbedFrom.push({ slug: p.slug, name: p.name, rows: cp.rows, amountUsd: cp.amountUsd });
    }
  }

  return profiles.sort(
    (a, b) => b.totals.claimedUsd - a.totals.claimedUsd || a.name.localeCompare(b.name),
  );
}

export function findProfile(profiles: CompanyProfile[], slug: string): CompanyProfile | null {
  return profiles.find((p) => p.slug === slug) ?? null;
}

/* ------------------------------------------------------------------ */

/**
 * The generated verdict.
 *
 * Assembled in four moves: what the company claimed, whether any of it
 * reached a filing, where it landed instead, and what stopped it. Every
 * clause is dropped rather than fudged when the data behind it is
 * absent, so the sentence gets shorter on a thin row rather than making
 * something up.
 */
export function verdict(p: CompanyProfile, fmtUsd: (n: number) => string): string {
  const t = p.totals;
  const sentences: string[] = [];

  // 1. What was claimed.
  if (t.gainClaims === 0) {
    const kinds: string[] = [];
    if (p.counterEvidence.length) {
      kinds.push(`${p.counterEvidence.length} ${plural(p.counterEvidence.length, 'row')} of counter-evidence`);
    }
    const others = t.rows - p.counterEvidence.length;
    if (others > 0) kinds.push(`${others} of context`);
    sentences.push(
      `${p.name} makes no gain claim in this ledger${kinds.length ? `: it appears as ${listOf(kinds)}` : ''}.`,
    );
  } else if (t.dollarClaims === 0) {
    sentences.push(
      `${p.name} makes ${t.gainClaims} gain ${plural(t.gainClaims, 'claim')} here, none of which names a figure in dollars.`,
    );
  } else {
    sentences.push(
      `${p.name} claims ${fmtUsd(t.claimedUsd)} of AI gains across ${t.dollarClaims} ${plural(
        t.dollarClaims,
        'claim',
      )}${
        t.nonDollarClaims > 0
          ? `, with ${t.nonDollarClaims} further ${plural(t.nonDollarClaims, 'claim')} stated in other units`
          : ''
      }.`,
    );
  }

  // 2. Whether any of it reached a filing.
  if (t.dollarClaims > 0) {
    if (t.tracedUsd <= 0) {
      sentences.push('None of it can be matched to a named line item in a filing.');
    } else if (t.tracedUsd >= t.claimedUsd) {
      sentences.push('All of it can be matched to a named line item in a filing.');
    } else {
      sentences.push(
        `${fmtUsd(t.tracedUsd)} of that reaches a named line item in a filing, and ${fmtUsd(
          t.untracedUsd,
        )} does not.`,
      );
    }
  } else if (t.tracedOutsideDenominatorUsd > 0) {
    sentences.push(
      `${fmtUsd(t.tracedOutsideDenominatorUsd)} is traceable to a filing line even though the claim itself named no dollar figure.`,
    );
  }

  // 3. Where it landed instead.
  if (p.destinationMix.length > 0) {
    const names = p.destinationMix.map((d) => destination(d.rank).verb);
    sentences.push(
      p.destinationMix.length === 1
        ? `The gains are coded as ${names[0]}.`
        : `The gains are coded across ${p.destinationMix.length} destinations: ${listOf(names)}.`,
    );
  }

  // 4. What stopped it, from the three conditions.
  //
  // A failing condition is named whenever one is coded false, even if
  // another is uncoded — "at least one condition is not coded" is true
  // but useless when the ledger already knows which one fails.
  const failed = CONDITION_LIST.filter((c) => p.conditions[c.key] === false).map((c) =>
    c.name.toLowerCase(),
  );
  const uncoded = CONDITION_LIST.filter((c) => p.conditions[c.key] === null).length;

  if (p.conditionsPassed === 3) {
    sentences.push('All three conditions for a gain to reach profit are coded as met.');
  } else if (failed.length) {
    sentences.push(
      `${failed.length === 1 ? 'The condition that fails is' : 'The conditions that fail are'} ${listOf(
        failed,
      )}.${uncoded > 0 ? ` ${uncoded} of the three ${uncoded === 1 ? 'is' : 'are'} not coded.` : ''}`,
    );
  } else if (uncoded > 0 && p.gains.length > 0) {
    sentences.push(
      `${uncoded} of the three conditions for a gain to reach profit ${uncoded === 1 ? 'is' : 'are'} not coded for this company.`,
    );
  }

  return sentences.join(' ');
}

/** Companies with no rows at all after a filter — stated, never hidden. */
export function emptyProfileNote(slug: string): string {
  return `No row in the ledger belongs to “${slug}”. It may have been renamed, or the link may be from an older version of this page.`;
}
