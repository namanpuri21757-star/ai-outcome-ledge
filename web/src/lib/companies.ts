import type { LedgerRow } from './types';
import { destination, group } from './labels';
import { usd, bps } from './format';

/* ===================================================================
   THE COMPANY ROLL-UP

   The ledger's atom is a claim. The reader's atom is a company: they
   ask "what is the whole picture on IBM", not "show me claim 41".
   Every click that names a company needs somewhere coherent to land,
   and this is the data behind that place.

   Everything here is derived, never typed. The verdict sentence is
   assembled from the numbers on each run, so it cannot go stale and
   cannot say something the rows do not support.
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
  context: LedgerRow[];

  claimedUsd: number;
  tracedUsd: number;
  untracedUsd: number;

  /** Destination ranks present, most rows first. */
  destinationMix: Array<{ rank: number; rows: number; claimedUsd: number }>;
  /** The single destination most of this company's gain claims landed in. */
  dominantDestination: number | null;

  /** Conditions, when every coded row agrees. Null when they disagree or are uncoded. */
  conditions: { billing: boolean | null; sink: boolean | null; permission: boolean | null };
  conditionsPassed: number | null;

  /** Best available measured margin movement one year after a claim. */
  marginDelta4qBps: number | null;
  marginMeasuredOn: string | null;

  counterparties: Array<{ slug: string | null; name: string; rows: number; amountUsd: number }>;
  /** Companies whose claims name this one as the supplier that absorbed the loss. */
  absorbedFrom: Array<{ slug: string; name: string; rows: number; amountUsd: number }>;

  firstClaim: string | null;
  lastClaim: string | null;
  hasCounterMove: boolean;
}

export function buildProfiles(rows: LedgerRow[]): CompanyProfile[] {
  const bySlug = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    const list = bySlug.get(r.company_slug) ?? [];
    list.push(r);
    bySlug.set(r.company_slug, list);
  }

  // Reverse index: who names this company as the supplier who paid.
  const absorbed = new Map<string, Map<string, { name: string; rows: number; amountUsd: number }>>();
  for (const r of rows) {
    if (!r.counterparty_absorbed || !r.counterparty_slug) continue;
    const inner = absorbed.get(r.counterparty_slug) ?? new Map();
    const cur = inner.get(r.company_slug) ?? { name: r.company_name, rows: 0, amountUsd: 0 };
    cur.rows += 1;
    cur.amountUsd += r.transfer_amount_usd ?? 0;
    inner.set(r.company_slug, cur);
    absorbed.set(r.counterparty_slug, inner);
  }

  const out: CompanyProfile[] = [];

  for (const [slug, list] of bySlug) {
    const sorted = [...list].sort((a, b) => a.claim_date.localeCompare(b.claim_date));
    const head = sorted[0];
    const gains = sorted.filter((r) => r.claim_kind === 'gain_claim');

    const claimedUsd = sumOf(gains, (r) => r.claimed_amount_usd);
    const tracedUsd = sumOf(gains, (r) => r.traceable_to_pl_usd);

    const destMap = new Map<number, { rank: number; rows: number; claimedUsd: number }>();
    for (const r of gains) {
      const cur = destMap.get(r.destination) ?? { rank: r.destination, rows: 0, claimedUsd: 0 };
      cur.rows += 1;
      cur.claimedUsd += r.claimed_amount_usd ?? 0;
      destMap.set(r.destination, cur);
    }
    const destinationMix = [...destMap.values()].sort(
      (a, b) => b.rows - a.rows || b.claimedUsd - a.claimedUsd,
    );
    const coded = destinationMix.filter((d) => d.rank > 0);

    const cpMap = new Map<string, { slug: string | null; name: string; rows: number; amountUsd: number }>();
    for (const r of sorted) {
      if (!r.counterparty_absorbed) continue;
      const key = r.counterparty_slug ?? 'unnamed';
      const cur =
        cpMap.get(key) ??
        { slug: r.counterparty_slug, name: r.counterparty_name ?? 'Unnamed supplier', rows: 0, amountUsd: 0 };
      cur.rows += 1;
      cur.amountUsd += r.transfer_amount_usd ?? 0;
      cpMap.set(key, cur);
    }

    const withMargin = sorted
      .filter((r) => r.margin_delta_4q_bps !== null && r.margin_delta_4q_bps !== undefined)
      .sort((a, b) => b.claim_date.localeCompare(a.claim_date));

    const conditions = {
      billing: unanimous(sorted.map((r) => r.cond_billing_unit_survives)),
      sink: unanimous(sorted.map((r) => r.cond_demand_sink)),
      permission: unanimous(sorted.map((r) => r.cond_permission_to_act)),
    };
    const condVals = [conditions.billing, conditions.sink, conditions.permission];
    const conditionsPassed = condVals.some((v) => v === null)
      ? null
      : condVals.filter(Boolean).length;

    out.push({
      slug,
      name: head.company_name,
      ticker: head.company_ticker,
      sector: head.sector,
      groupCode: head.group_code,
      groupName: group(head.group_code).name,
      isPublic: head.company_is_public,

      rows: sorted,
      gains,
      counterEvidence: sorted.filter((r) => r.claim_kind === 'counter_evidence'),
      context: sorted.filter(
        (r) => r.claim_kind === 'context' || r.claim_kind === 'pricing' || r.claim_kind === 'research_finding',
      ),

      claimedUsd,
      tracedUsd,
      untracedUsd: claimedUsd - tracedUsd,

      destinationMix,
      dominantDestination: coded.length ? coded[0].rank : null,

      conditions,
      conditionsPassed,

      marginDelta4qBps: withMargin.length ? withMargin[0].margin_delta_4q_bps : null,
      marginMeasuredOn: withMargin.length ? withMargin[0].claim_date : null,

      counterparties: [...cpMap.values()].sort((a, b) => b.amountUsd - a.amountUsd || b.rows - a.rows),
      absorbedFrom: [...(absorbed.get(slug)?.entries() ?? [])]
        .map(([s, v]) => ({ slug: s, name: v.name, rows: v.rows, amountUsd: v.amountUsd }))
        .sort((a, b) => b.amountUsd - a.amountUsd),

      firstClaim: sorted.length ? sorted[0].claim_date : null,
      lastClaim: sorted.length ? sorted[sorted.length - 1].claim_date : null,
      hasCounterMove: sorted.some((r) => !!r.observed_counter_move),
    });
  }

  return out.sort((a, b) => b.claimedUsd - a.claimedUsd || b.rows.length - a.rows.length);
}

export function findProfile(profiles: CompanyProfile[], slug: string): CompanyProfile | null {
  return profiles.find((p) => p.slug === slug) ?? null;
}

/**
 * One sentence, generated. Never typed, so it cannot contradict the rows
 * beneath it and cannot go stale when the collector updates a margin.
 */
export function verdict(p: CompanyProfile): string {
  const parts: string[] = [];

  if (p.gains.length === 0) {
    parts.push(
      p.rows.length === 1
        ? 'One row, and it is not a claim that AI produced a gain.'
        : `${p.rows.length} rows, none of which claim AI produced a gain.`,
    );
  } else {
    const n = p.gains.length;
    const money = p.claimedUsd > 0 ? ` worth ${usd(p.claimedUsd)}` : '';
    parts.push(`${n} gain claim${n === 1 ? '' : 's'}${money}.`);

    if (p.claimedUsd > 0) {
      parts.push(
        p.tracedUsd === 0
          ? 'None of it can be matched to a line item in a filing.'
          : p.tracedUsd >= p.claimedUsd
            ? 'All of it is matched to a disclosed line item.'
            : `${usd(p.tracedUsd)} of it is matched to a disclosed line item; ${usd(p.untracedUsd)} is not.`,
      );
    }

    if (p.dominantDestination) {
      const d = destination(p.dominantDestination);
      const mixed = p.destinationMix.filter((m) => m.rank > 0).length > 1;
      parts.push(mixed ? `Most of it was ${d.verb}.` : `It was ${d.verb}.`);
    }
  }

  if (p.marginDelta4qBps !== null) {
    const dir = p.marginDelta4qBps > 0 ? 'wider' : p.marginDelta4qBps < 0 ? 'narrower' : 'unchanged';
    parts.push(
      `Operating margin one year after the most recent measurable claim: ${bps(p.marginDelta4qBps)} — ${dir}.`,
    );
  } else if (p.isPublic) {
    parts.push('No measured margin movement is available for this company yet.');
  }

  if (p.hasCounterMove) {
    parts.push('At least one row records a figure that moved the other way.');
  }

  return parts.join(' ');
}

function sumOf(rows: LedgerRow[], pick: (r: LedgerRow) => number | null): number {
  return rows.reduce((a, r) => a + (pick(r) ?? 0), 0);
}

/** True/false only when every non-null coded value agrees; otherwise null. */
export function unanimous(values: Array<boolean | null>): boolean | null {
  const set = new Set(values.filter((v): v is boolean => v !== null && v !== undefined));
  if (set.size !== 1) return null;
  return [...set][0];
}
