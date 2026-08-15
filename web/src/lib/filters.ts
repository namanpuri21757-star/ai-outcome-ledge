import type { ClaimKind, LedgerRow, MeasurementBasis, VerificationStatus } from './types';
import { basis, destination, group, kind, verification } from './labels';

/* ===================================================================
   The selection.

   Eight dimensions, down from seventeen. The ones removed — epistemic
   tag, evidence tier, sector, counterparty-only, conflict-only, the two
   condition filters, and the date range — were each a chip on a wall
   that a reader arriving from a headline never touches. Every field they
   filtered on is still coded, still shown on the claim page, and still
   in the CSV export.

   `totals` does not live here. Every money figure comes from
   `aggregate.ts`, which is the only file allowed to add dollars up.
   =================================================================== */

export interface Filters {
  search: string;
  kinds: ClaimKind[];
  bases: MeasurementBasis[];
  destinations: number[];
  verification: VerificationStatus[];
  groups: string[];
  companies: string[];
  /** Only gain claims that named a figure in dollars. */
  dollarsOnly: boolean;
}

export const EMPTY_FILTERS: Filters = {
  search: '',
  kinds: [],
  bases: [],
  destinations: [],
  verification: [],
  groups: [],
  companies: [],
  dollarsOnly: false,
};

export function isFilterActive(f: Filters): boolean {
  return activeFilterChips(f).length > 0;
}

/* ------------------------------------------------------------------ */

export interface FilterChip {
  id: string;
  /** Always words. A chip that reads `dest=5` is a chip nobody removes. */
  label: string;
  clear: (f: Filters) => Filters;
}

export function activeFilterChips(f: Filters): FilterChip[] {
  const out: FilterChip[] = [];

  if (f.search.trim()) {
    out.push({
      id: 'search',
      label: `Text: “${f.search.trim()}”`,
      clear: (x) => ({ ...x, search: '' }),
    });
  }
  for (const k of f.kinds) {
    out.push({
      id: `kind:${k}`,
      label: kind(k).name,
      clear: (x) => ({ ...x, kinds: x.kinds.filter((v) => v !== k) }),
    });
  }
  for (const d of f.destinations) {
    out.push({
      id: `dest:${d}`,
      label: destination(d).name,
      clear: (x) => ({ ...x, destinations: x.destinations.filter((v) => v !== d) }),
    });
  }
  for (const b of f.bases) {
    out.push({
      id: `basis:${b}`,
      label: basis(b).name,
      clear: (x) => ({ ...x, bases: x.bases.filter((v) => v !== b) }),
    });
  }
  for (const v of f.verification) {
    out.push({
      id: `ver:${v}`,
      label: verification(v).name,
      clear: (x) => ({ ...x, verification: x.verification.filter((n) => n !== v) }),
    });
  }
  for (const g of f.groups) {
    out.push({
      id: `group:${g}`,
      label: group(g).name,
      clear: (x) => ({ ...x, groups: x.groups.filter((v) => v !== g) }),
    });
  }
  for (const c of f.companies) {
    out.push({
      id: `co:${c}`,
      label: c,
      clear: (x) => ({ ...x, companies: x.companies.filter((v) => v !== c) }),
    });
  }
  if (f.dollarsOnly) {
    out.push({
      id: 'dollars',
      label: 'Stated in dollars',
      clear: (x) => ({ ...x, dollarsOnly: false }),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */

function haystack(row: LedgerRow): string {
  return [
    row.company_name,
    row.company_slug,
    row.headline,
    row.claim_detail,
    row.measurement_definition,
    row.destination_rationale,
    row.reconciliation_note,
    row.observed_counter_move,
    row.conditions_note,
    row.counterparty_name,
    row.sector,
    row.source_name,
    row.ref,
    destination(row.destination).name,
    basis(row.measurement_basis).name,
    group(row.group_code).name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function matchesSearch(row: LedgerRow, search: string): boolean {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
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
    if (f.verification.length && !f.verification.includes(r.verification_status)) return false;
    if (f.groups.length && !(r.group_code && f.groups.includes(r.group_code))) return false;
    if (f.companies.length && !f.companies.includes(r.company_slug)) return false;
    // A claim of $0 is not a claim stated in dollars.
    if (f.dollarsOnly && !((r.claimed_amount_usd ?? 0) > 0)) return false;
    return true;
  });
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/* ------------------------------------------------------------------ */

export type SortKey = 'claim_date' | 'company_name' | 'claimed_amount_usd' | 'traceable_to_pl_usd';

/**
 * A missing dollar figure is not zero and not the smallest value. It
 * sorts last in *both* directions, because a claim that named no amount
 * is not the cheapest claim in the ledger.
 */
export function sortRows(rows: LedgerRow[], key: SortKey, dir: 'asc' | 'desc'): LedgerRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const aNull = av === null || av === undefined;
    const bNull = bv === null || bv === undefined;
    if (aNull && bNull) return a.ref.localeCompare(b.ref);
    if (aNull) return 1;
    if (bNull) return -1;
    if (typeof av === 'number' && typeof bv === 'number') {
      return av === bv ? a.ref.localeCompare(b.ref) : (av - bv) * sign;
    }
    const cmp = String(av).localeCompare(String(bv));
    return cmp === 0 ? a.ref.localeCompare(b.ref) : cmp * sign;
  });
}

/* ------------------------------------------------------------------ */

/** The values actually present in the corpus, so a filter can never
 *  offer a choice that matches nothing. */
export interface FilterOptions {
  kinds: Array<{ value: ClaimKind; count: number }>;
  destinations: Array<{ value: number; count: number }>;
  bases: Array<{ value: MeasurementBasis; count: number }>;
  verification: Array<{ value: VerificationStatus; count: number }>;
  groups: Array<{ value: string; count: number }>;
}

function tally<T extends string | number>(
  rows: LedgerRow[],
  pick: (r: LedgerRow) => T | null,
  order: T[],
): Array<{ value: T; count: number }> {
  const counts = new Map<T, number>();
  for (const r of rows) {
    const v = pick(r);
    if (v === null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const known = order.filter((v) => counts.has(v));
  const extra = [...counts.keys()].filter((v) => !order.includes(v)).sort();
  return [...known, ...extra].map((value) => ({ value, count: counts.get(value)! }));
}

export function filterOptions(
  rows: LedgerRow[],
  order: {
    kinds: ClaimKind[];
    destinations: number[];
    bases: MeasurementBasis[];
    verification: VerificationStatus[];
  },
): FilterOptions {
  return {
    kinds: tally(rows, (r) => r.claim_kind, order.kinds),
    destinations: tally(rows, (r) => r.destination, order.destinations),
    bases: tally(rows, (r) => r.measurement_basis, order.bases),
    verification: tally(rows, (r) => r.verification_status, order.verification),
    groups: tally(rows, (r) => r.group_code, []),
  };
}
