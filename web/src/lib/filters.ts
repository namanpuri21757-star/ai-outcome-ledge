import type { ClaimKind, EpistemicTag, LedgerRow, MeasurementBasis } from './types';
import { basis, destination, group, CONDITIONS, KINDS } from './labels';

/**
 * Every view reads one filter object, so a selection made on the
 * destinations page is still in force when you switch to the ledger.
 */
export type ConditionKey = 'billing' | 'sink' | 'permission';

export const CONDITION_KEYS: ConditionKey[] = ['billing', 'sink', 'permission'];

export interface Filters {
  search: string;
  kinds: ClaimKind[];
  bases: MeasurementBasis[];
  destinations: number[];
  tags: EpistemicTag[];
  tiers: number[];
  groups: string[];
  companies: string[];
  sectors: string[];
  /** Rows where these named conditions are met. */
  conditionsMet: ConditionKey[];
  /** Rows where exactly this many of the three conditions are met. */
  conditionCounts: number[];
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
  sectors: [],
  conditionsMet: [],
  conditionCounts: [],
  counterpartyOnly: false,
  conflictOnly: false,
  unverifiedOnly: false,
  dollarsOnly: false,
  from: null,
  to: null,
};

/**
 * How many of the three conditions this row meets.
 *
 * Null when any of the three is uncoded, because an uncoded condition
 * is not a failed one. Returning 2 for a row that is really "two met
 * and one unknown" would put it in the same bucket as a row that was
 * actually tested and failed, which is the specific mistake this
 * project exists to avoid.
 */
export function rowConditionCount(r: LedgerRow): number | null {
  const vals = [r.cond_billing_unit_survives, r.cond_demand_sink, r.cond_permission_to_act];
  if (vals.some((v) => v === null || v === undefined)) return null;
  return vals.filter(Boolean).length;
}

const CONDITION_FIELD: Record<ConditionKey, keyof LedgerRow> = {
  billing: 'cond_billing_unit_survives',
  sink: 'cond_demand_sink',
  permission: 'cond_permission_to_act',
};

export function meetsCondition(r: LedgerRow, key: ConditionKey): boolean {
  return r[CONDITION_FIELD[key]] === true;
}

export function isFilterActive(f: Filters): boolean {
  return activeFilterChips(f).length > 0;
}

/**
 * The filters currently in force, as removable chips.
 *
 * This exists because "did my click do anything?" is a feedback question,
 * not a logic question. The filters always worked; the interface never
 * said so anywhere near where the click happened.
 */
export interface FilterChip {
  /** Stable id, used as a React key. */
  id: string;
  /** What the reader sees. */
  label: string;
  /** Removing this chip returns these filters. */
  clear: (f: Filters) => Filters;
}

export function activeFilterChips(f: Filters): FilterChip[] {
  const chips: FilterChip[] = [];

  if (f.search.trim()) {
    chips.push({
      id: 'search',
      label: `matching “${f.search.trim()}”`,
      clear: (x) => ({ ...x, search: '' }),
    });
  }
  for (const d of f.destinations) {
    chips.push({
      id: `dest-${d}`,
      label: destination(d).name.toLowerCase(),
      clear: (x) => ({ ...x, destinations: x.destinations.filter((v) => v !== d) }),
    });
  }
  for (const k of f.kinds) {
    chips.push({
      id: `kind-${k}`,
      label: KINDS[k].name.toLowerCase(),
      clear: (x) => ({ ...x, kinds: x.kinds.filter((v) => v !== k) }),
    });
  }
  for (const b of f.bases) {
    chips.push({
      id: `basis-${b}`,
      label: basis(b).name.toLowerCase(),
      clear: (x) => ({ ...x, bases: x.bases.filter((v) => v !== b) }),
    });
  }
  for (const g of f.groups) {
    chips.push({
      id: `group-${g}`,
      label: group(g).name.toLowerCase(),
      clear: (x) => ({ ...x, groups: x.groups.filter((v) => v !== g) }),
    });
  }
  for (const c of f.companies) {
    chips.push({
      id: `company-${c}`,
      label: c,
      clear: (x) => ({ ...x, companies: x.companies.filter((v) => v !== c) }),
    });
  }
  for (const s of f.sectors) {
    chips.push({
      id: `sector-${s}`,
      label: s.toLowerCase(),
      clear: (x) => ({ ...x, sectors: x.sectors.filter((v) => v !== s) }),
    });
  }
  for (const k of f.conditionsMet) {
    chips.push({
      id: `cond-${k}`,
      label: `${CONDITIONS[k].name.toLowerCase()} met`,
      clear: (x) => ({ ...x, conditionsMet: x.conditionsMet.filter((v) => v !== k) }),
    });
  }
  for (const n of f.conditionCounts) {
    chips.push({
      id: `condcount-${n}`,
      label: n === 3 ? 'all three conditions met' : `${n} of three conditions met`,
      clear: (x) => ({ ...x, conditionCounts: x.conditionCounts.filter((v) => v !== n) }),
    });
  }
  for (const t of f.tags) {
    chips.push({
      id: `tag-${t}`,
      label: `${t} only`,
      clear: (x) => ({ ...x, tags: x.tags.filter((v) => v !== t) }),
    });
  }
  for (const t of f.tiers) {
    chips.push({
      id: `tier-${t}`,
      label: `tier ${t}`,
      clear: (x) => ({ ...x, tiers: x.tiers.filter((v) => v !== t) }),
    });
  }
  if (f.counterpartyOnly) {
    chips.push({
      id: 'counterparty',
      label: 'a supplier absorbed it',
      clear: (x) => ({ ...x, counterpartyOnly: false }),
    });
  }
  if (f.conflictOnly) {
    chips.push({
      id: 'conflict',
      label: 'conflicted source',
      clear: (x) => ({ ...x, conflictOnly: false }),
    });
  }
  if (f.unverifiedOnly) {
    chips.push({
      id: 'unverified',
      label: 'not primary-sourced',
      clear: (x) => ({ ...x, unverifiedOnly: false }),
    });
  }
  if (f.dollarsOnly) {
    chips.push({
      id: 'dollars',
      label: 'has a dollar figure',
      clear: (x) => ({ ...x, dollarsOnly: false }),
    });
  }
  if (f.from) {
    chips.push({ id: 'from', label: `from ${f.from}`, clear: (x) => ({ ...x, from: null }) });
  }
  if (f.to) {
    chips.push({ id: 'to', label: `to ${f.to}`, clear: (x) => ({ ...x, to: null }) });
  }

  return chips;
}

function haystack(r: LedgerRow): string {
  return [
    r.company_name,
    r.company_slug,
    r.headline,
    r.claim_detail,
    r.measurement_definition,
    r.destination_rationale,
    r.reconciliation_note,
    r.observed_counter_move,
    r.conditions_note,
    r.counterparty_name,
    r.sector,
    r.source_name,
    r.ref,
    destination(r.destination).name,
    basis(r.measurement_basis).name,
    group(r.group_code).name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Every term must appear somewhere in the row. */
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
    if (f.sectors.length && !(r.sector && f.sectors.includes(r.sector))) return false;
    if (f.conditionsMet.length && !f.conditionsMet.every((k) => meetsCondition(r, k))) return false;
    if (f.conditionCounts.length) {
      const n = rowConditionCount(r);
      // A row with an uncoded condition has no count, so it cannot
      // match a count filter. It is excluded, not counted as zero.
      if (n === null || !f.conditionCounts.includes(n)) return false;
    }
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

/** Nulls sort last in both directions: an absent margin delta is not the
 *  smallest one, and it should never lead the table. */
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
 * Only gain claims contribute to the money totals. Counter-evidence,
 * context, pricing and research rows carry dollar figures too — a $2T
 * market-cap loss, a $6.3B acquisition, a $2B spend line — and summing
 * them would produce a headline number that means nothing.
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
 * Who is taking money from whom. Rows where a supplier absorbed the loss
 * but no specific firm was named collapse into one unnamed node, because
 * inventing a counterparty would be worse than admitting that most of the
 * time nobody has established one.
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
  companies: string[];
  meanMarginDelta4qBps: number | null;
  /** How many rows in this cell have a measured margin movement at all. */
  measured: number;
}

/** The 2×2×2 from the source research, populated from live rows. */
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
          companies: [...new Set(matched.map((r) => r.company_slug))],
          measured: deltas.length,
          meanMarginDelta4qBps: deltas.length
            ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
            : null,
        });
      }
    }
  }
  return cells.sort((a, b) => b.passes - a.passes || b.rows.length - a.rows.length);
}

/** Toggle a value in and out of a multi-select array. */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

