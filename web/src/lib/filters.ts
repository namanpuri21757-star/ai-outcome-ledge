import type { ClaimKind, EpistemicTag, LedgerRow, MeasurementBasis } from './types';

/**
 * Every view reads from one filter object. That is what makes the thing a
 * connection-making tool rather than eight separate charts: clicking a
 * counterparty on the transfer map and then switching to the ledger shows
 * you the same subset, not a fresh unfiltered table.
 */
export interface Filters {
  search: string;
  kinds: ClaimKind[];
  bases: MeasurementBasis[];
  destinations: number[];
  tags: EpistemicTag[];
  tiers: number[];
  groups: string[];
  companies: string[];
  counterpartyOnly: boolean;
  conflictOnly: boolean;
  unverifiedOnly: boolean;
  dollarsOnly: boolean;
  from: string | null;
  to: string | null;
}

export const EMPTY_FILTERS: Filters = {
  search: '',
  kinds: [],
  bases: [],
  destinations: [],
  tags: [],
  tiers: [],
  groups: [],
  companies: [],
  counterpartyOnly: false,
  conflictOnly: false,
  unverifiedOnly: false,
  dollarsOnly: false,
  from: null,
  to: null,
};

export function isFilterActive(f: Filters): boolean {
  return (
    f.search.trim().length > 0 ||
    f.kinds.length > 0 ||
    f.bases.length > 0 ||
    f.destinations.length > 0 ||
    f.tags.length > 0 ||
    f.tiers.length > 0 ||
    f.groups.length > 0 ||
    f.companies.length > 0 ||
    f.counterpartyOnly ||
    f.conflictOnly ||
    f.unverifiedOnly ||
    f.dollarsOnly ||
    f.from !== null ||
    f.to !== null
  );
}

function haystack(r: LedgerRow): string {
  return [
    r.company_name,
    r.headline,
    r.claim_detail,
    r.measurement_definition,
    r.destination_rationale,
    r.reconciliation_note,
    r.observed_counter_move,
    r.counterparty_name,
    r.sector,
    r.source_name,
    r.ref,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Every term must appear somewhere. Multi-word search that requires all
 *  terms is far more useful than one that requires the exact phrase. */
export function matchesSearch(row: LedgerRow, search: string): boolean {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = haystack(row);
  return terms.every((t) => hay.includes(t));
}

export function applyFilters(rows: LedgerRow[], f: Filters): LedgerRow[] {
  return rows.filter((r) => {
    if (!matchesSearch(r, f.search)) return false;
    if (f.kinds.length && !f.kinds.includes(r.claim_kind)) return false;
    if (f.bases.length && !f.bases.includes(r.measurement_basis)) return false;
    if (f.destinations.length && !f.destinations.includes(r.destination)) return false;
    if (f.tags.length && !f.tags.includes(r.epistemic_tag)) return false;
    if (f.tiers.length && !f.tiers.includes(r.evidence_tier)) return false;
    if (f.groups.length && !(r.group_code && f.groups.includes(r.group_code))) return false;
    if (f.companies.length && !f.companies.includes(r.company_slug)) return false;
    if (f.counterpartyOnly && !r.counterparty_absorbed) return false;
    if (f.conflictOnly && !r.conflict_of_interest) return false;
    if (f.unverifiedOnly && r.verification_status === 'verified_primary') return false;
    if (f.dollarsOnly && !r.claimed_amount_usd) return false;
    if (f.from && r.claim_date < f.from) return false;
    if (f.to && r.claim_date > f.to) return false;
    return true;
  });
}

export type SortKey =
  | 'claim_date'
  | 'company_name'
  | 'claimed_amount_usd'
  | 'unreconciled_usd'
  | 'destination'
  | 'evidence_tier'
  | 'margin_delta_4q_bps';

/** Nulls always sort last regardless of direction. A missing margin delta is
 *  not "the smallest one"; it is an absence, and it should not lead the table. */
export function sortRows(rows: LedgerRow[], key: SortKey, dir: 'asc' | 'desc'): LedgerRow[] {
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key] as string | number | null;
    const bv = b[key] as string | number | null;
    const aNull = av === null || av === undefined;
    const bNull = bv === null || bv === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul;
    return String(av).localeCompare(String(bv)) * mul;
  });
}

export interface Totals {
  claims: number;
  companies: number;
  claimedUsd: number;
  tracedUsd: number;
  unreconciledUsd: number;
  transferredUsd: number;
  dollarClaims: number;
  reconciledPct: number | null;
}

/**
 * Only gain claims contribute to the money totals. Counter-evidence, context,
 * pricing and research rows carry dollar figures too — a $2T market-cap loss,
 * a $6.3B transaction, a $2B spend line — and adding them to the claimed total
 * would produce a headline number that means nothing.
 */
export function totals(rows: LedgerRow[]): Totals {
  const gains = rows.filter((r) => r.claim_kind === 'gain_claim');
  const claimedUsd = sum(gains.map((r) => r.claimed_amount_usd));
  const tracedUsd = sum(gains.map((r) => r.traceable_to_pl_usd));
  return {
    claims: rows.length,
    companies: new Set(rows.map((r) => r.company_slug)).size,
    claimedUsd,
    tracedUsd,
    unreconciledUsd: claimedUsd - tracedUsd,
    transferredUsd: sum(rows.map((r) => r.transfer_amount_usd)),
    dollarClaims: gains.filter((r) => r.claimed_amount_usd).length,
    reconciledPct: claimedUsd > 0 ? (tracedUsd / claimedUsd) * 100 : null,
  };
}

function sum(xs: Array<number | null>): number {
  return xs.reduce<number>((a, b) => a + (b ?? 0), 0);
}

export interface GroupCount<T extends string | number> {
  key: T;
  claims: number;
  claimedUsd: number;
  unreconciledUsd: number;
}

export function groupBy<T extends string | number>(
  rows: LedgerRow[],
  pick: (r: LedgerRow) => T,
): GroupCount<T>[] {
  const map = new Map<T, GroupCount<T>>();
  for (const r of rows) {
    const key = pick(r);
    const cur = map.get(key) ?? { key, claims: 0, claimedUsd: 0, unreconciledUsd: 0 };
    cur.claims += 1;
    if (r.claim_kind === 'gain_claim') {
      cur.claimedUsd += r.claimed_amount_usd ?? 0;
      cur.unreconciledUsd += (r.claimed_amount_usd ?? 0) - (r.traceable_to_pl_usd ?? 0);
    }
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.claims - a.claims);
}

export interface TransferEdge {
  fromSlug: string;
  fromName: string;
  toSlug: string | null;
  toName: string;
  claims: number;
  amountUsd: number;
}

/**
 * Who is taking money from whom. Claims where a counterparty absorbed the
 * loss but no specific firm was named collapse into one "unnamed" node,
 * because pretending we know the counterparty would be worse than admitting
 * that most of the time nobody has established it.
 */
export function transferEdges(rows: LedgerRow[]): TransferEdge[] {
  const map = new Map<string, TransferEdge>();
  for (const r of rows) {
    if (!r.counterparty_absorbed) continue;
    const toSlug = r.counterparty_slug;
    const toName = r.counterparty_name ?? 'Unnamed counterparty';
    const key = `${r.company_slug}->${toSlug ?? 'unnamed'}`;
    const cur =
      map.get(key) ??
      ({
        fromSlug: r.company_slug,
        fromName: r.company_name,
        toSlug,
        toName,
        claims: 0,
        amountUsd: 0,
      } satisfies TransferEdge);
    cur.claims += 1;
    cur.amountUsd += r.transfer_amount_usd ?? 0;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.amountUsd - a.amountUsd || b.claims - a.claims);
}

export interface ConditionCell {
  billing: boolean;
  sink: boolean;
  permission: boolean;
  passes: number;
  rows: LedgerRow[];
  meanMarginDelta4qBps: number | null;
}

/** The 2x2x2 from Part III of the source research, populated with live data. */
export function conditionCells(rows: LedgerRow[]): ConditionCell[] {
  const cells: ConditionCell[] = [];
  for (const billing of [true, false]) {
    for (const sink of [true, false]) {
      for (const permission of [true, false]) {
        const matched = rows.filter(
          (r) =>
            r.cond_billing_unit_survives === billing &&
            r.cond_demand_sink === sink &&
            r.cond_permission_to_act === permission,
        );
        const deltas = matched
          .map((r) => r.margin_delta_4q_bps)
          .filter((d): d is number => d !== null && d !== undefined);
        cells.push({
          billing,
          sink,
          permission,
          passes: [billing, sink, permission].filter(Boolean).length,
          rows: matched,
          meanMarginDelta4qBps: deltas.length
            ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
            : null,
        });
      }
    }
  }
  return cells.sort((a, b) => b.passes - a.passes);
}

/** Toggle a value in and out of a multi-select array. */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
