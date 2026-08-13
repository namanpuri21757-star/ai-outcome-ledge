import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  applyFilters,
  conditionCells,
  groupBy,
  isFilterActive,
  matchesSearch,
  sortRows,
  toggle,
  totals,
  transferEdges,
} from '../src/lib/filters';
import { csvCell, toCsv } from '../src/lib/csv';
import { bps, claimedValue, pct, ratioAsPct, shortDate, usd } from '../src/lib/format';
import { edgarFullTextSearch, searchPhrase, sourceLinks } from '../src/lib/sourceLinks';
import type { LedgerRow } from '../src/lib/types';

const base: LedgerRow = {
  id: '1', ref: 'x', claim_date: '2025-06-30', period_label: 'Q2 2025',
  headline: 'Firm reports $60M saved by the AI agent', claim_detail: null,
  claim_kind: 'gain_claim', claimed_amount_usd: 60_000_000, claimed_value: 60, claimed_unit: 'usd',
  measurement_basis: 'gross_capacity', measurement_definition: 'Avoided labour at loaded cost',
  destination: 1, destination_rationale: null,
  counterparty_absorbed: false, counterparty_note: null, transfer_amount_usd: null,
  traceable_to_pl_usd: 0, unreconciled_usd: 60_000_000, reconciliation_note: null,
  observed_counter_move: null,
  cond_billing_unit_survives: false, cond_demand_sink: false, cond_permission_to_act: false,
  conditions_note: null,
  epistemic_tag: 'fact', evidence_tier: 1, conflict_of_interest: false, coi_note: null,
  verification_status: 'verified_primary', verify_hint: null,
  source_type: 'earnings_call', source_name: 'Q3 call', source_url: null, source_date: '2025-11-18',
  company_name: 'Klarna', company_slug: 'klarna', company_ticker: 'KLAR',
  sector: 'Fintech', group_code: 'D', group_label: 'Large incumbent', company_is_public: true,
  counterparty_name: null, counterparty_slug: null,
  margin_delta_1q_bps: -20, margin_delta_4q_bps: -35, margin_baseline: 0.21, margin_t4q: 0.2065,
  price_delta_4q: -12.4,
};

const row = (patch: Partial<LedgerRow>, id = Math.random().toString(36).slice(2)): LedgerRow => ({
  ...base, ...patch, id,
});

describe('matchesSearch', () => {
  it('matches on the company name', () => {
    expect(matchesSearch(base, 'klarna')).toBe(true);
  });
  it('requires every term, not just one', () => {
    expect(matchesSearch(base, 'klarna saved')).toBe(true);
    expect(matchesSearch(base, 'klarna teleperformance')).toBe(false);
  });
  it('searches the measurement definition, which is where the useful language lives', () => {
    expect(matchesSearch(base, 'loaded cost')).toBe(true);
  });
  it('is case insensitive and treats an empty query as a match', () => {
    expect(matchesSearch(base, 'KLARNA')).toBe(true);
    expect(matchesSearch(base, '   ')).toBe(true);
  });
});

describe('applyFilters', () => {
  const rows = [
    base,
    row({ company_slug: 'ibm', company_name: 'IBM', destination: 5, measurement_basis: 'net_pl', evidence_tier: 2, conflict_of_interest: true, claim_kind: 'context', group_code: 'C' }),
    row({ company_slug: 'concentrix', company_name: 'Concentrix', counterparty_absorbed: true, counterparty_slug: 'bpo', counterparty_name: 'BPO sector', transfer_amount_usd: 130_000_000, claimed_amount_usd: null, verification_status: 'needs_primary_source' }),
  ];

  it('returns everything with no filters', () => {
    expect(applyFilters(rows, EMPTY_FILTERS)).toHaveLength(3);
  });
  it('filters by destination', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, destinations: [5] })).toHaveLength(1);
  });
  it('filters by row kind', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, kinds: ['gain_claim'] })).toHaveLength(2);
  });
  it('filters to counterparty rows only', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, counterpartyOnly: true })).toHaveLength(1);
  });
  it('filters to conflicted sources only', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, conflictOnly: true })).toHaveLength(1);
  });
  it('filters to anything lacking a primary source', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, unverifiedOnly: true })).toHaveLength(1);
  });
  it('filters to rows carrying a dollar figure', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, dollarsOnly: true })).toHaveLength(2);
  });
  it('combines filters with AND, not OR', () => {
    const out = applyFilters(rows, { ...EMPTY_FILTERS, destinations: [5], conflictOnly: true });
    expect(out).toHaveLength(1);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, destinations: [1], conflictOnly: true })).toHaveLength(0);
  });
  it('bounds by date', () => {
    const dated = [row({ claim_date: '2024-01-01' }), row({ claim_date: '2026-01-01' })];
    expect(applyFilters(dated, { ...EMPTY_FILTERS, from: '2025-01-01' })).toHaveLength(1);
    expect(applyFilters(dated, { ...EMPTY_FILTERS, to: '2025-01-01' })).toHaveLength(1);
  });
});

describe('isFilterActive', () => {
  it('is false for the empty filter and true once anything is set', () => {
    expect(isFilterActive(EMPTY_FILTERS)).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTERS, search: 'a' })).toBe(true);
    expect(isFilterActive({ ...EMPTY_FILTERS, dollarsOnly: true })).toBe(true);
  });
});

describe('sortRows', () => {
  const rows = [
    row({ claimed_amount_usd: 100, margin_delta_4q_bps: null }),
    row({ claimed_amount_usd: 300, margin_delta_4q_bps: -10 }),
    row({ claimed_amount_usd: 200, margin_delta_4q_bps: 40 }),
  ];

  it('sorts numerically in both directions', () => {
    expect(sortRows(rows, 'claimed_amount_usd', 'desc').map((r) => r.claimed_amount_usd)).toEqual([300, 200, 100]);
    expect(sortRows(rows, 'claimed_amount_usd', 'asc').map((r) => r.claimed_amount_usd)).toEqual([100, 200, 300]);
  });

  it('puts nulls last in BOTH directions — a missing margin is an absence, not a minimum', () => {
    expect(sortRows(rows, 'margin_delta_4q_bps', 'asc').at(-1)?.margin_delta_4q_bps).toBeNull();
    expect(sortRows(rows, 'margin_delta_4q_bps', 'desc').at(-1)?.margin_delta_4q_bps).toBeNull();
  });

  it('does not mutate the input', () => {
    const before = rows.map((r) => r.claimed_amount_usd);
    sortRows(rows, 'claimed_amount_usd', 'asc');
    expect(rows.map((r) => r.claimed_amount_usd)).toEqual(before);
  });

  it('sorts strings alphabetically', () => {
    const named = [row({ company_name: 'Zendesk' }), row({ company_name: 'Accenture' })];
    expect(sortRows(named, 'company_name', 'asc')[0].company_name).toBe('Accenture');
  });
});

describe('totals', () => {
  it('counts only gain claims toward the money, so a $2T market-cap row cannot distort it', () => {
    const rows = [
      row({ claimed_amount_usd: 60_000_000, traceable_to_pl_usd: 0, claim_kind: 'gain_claim' }),
      row({ claimed_amount_usd: 2_000_000_000_000, claim_kind: 'counter_evidence' }),
    ];
    const t = totals(rows);
    expect(t.claimedUsd).toBe(60_000_000);
    expect(t.unreconciledUsd).toBe(60_000_000);
    expect(t.claims).toBe(2);
  });

  it('computes the reconciled percentage', () => {
    const rows = [row({ claimed_amount_usd: 400, traceable_to_pl_usd: 350 })];
    expect(totals(rows).reconciledPct).toBeCloseTo(87.5, 5);
  });

  it('returns null rather than NaN when nothing carries a dollar figure', () => {
    expect(totals([row({ claimed_amount_usd: null })]).reconciledPct).toBeNull();
  });

  it('counts distinct companies, not rows', () => {
    expect(totals([base, row({ company_slug: 'klarna' })]).companies).toBe(1);
  });

  it('survives an empty selection', () => {
    const t = totals([]);
    expect(t.claims).toBe(0);
    expect(t.reconciledPct).toBeNull();
  });
});

describe('transferEdges', () => {
  it('ignores rows where no counterparty absorbed anything', () => {
    expect(transferEdges([base])).toHaveLength(0);
  });

  it('aggregates repeated pairs into one edge', () => {
    const rows = [
      row({ counterparty_absorbed: true, counterparty_slug: 'tp', counterparty_name: 'Teleperformance', transfer_amount_usd: 10 }),
      row({ counterparty_absorbed: true, counterparty_slug: 'tp', counterparty_name: 'Teleperformance', transfer_amount_usd: 15 }),
    ];
    const edges = transferEdges(rows);
    expect(edges).toHaveLength(1);
    expect(edges[0].claims).toBe(2);
    expect(edges[0].amountUsd).toBe(25);
  });

  it('collapses unnamed counterparties into one node instead of inventing a name', () => {
    const edges = transferEdges([
      row({ counterparty_absorbed: true, counterparty_slug: null, counterparty_name: null }),
    ]);
    expect(edges[0].toName).toBe('Unnamed counterparty');
    expect(edges[0].toSlug).toBeNull();
  });

  it('sorts by amount, then by claim count', () => {
    const edges = transferEdges([
      row({ company_slug: 'a', counterparty_absorbed: true, counterparty_slug: 'x', transfer_amount_usd: 5 }),
      row({ company_slug: 'b', counterparty_absorbed: true, counterparty_slug: 'y', transfer_amount_usd: 50 }),
    ]);
    expect(edges[0].fromSlug).toBe('b');
  });
});

describe('conditionCells', () => {
  it('places a row in exactly one of the eight cells', () => {
    const cells = conditionCells([base]).filter((c) => c.rows.length > 0);
    expect(cells).toHaveLength(1);
    expect(cells[0].passes).toBe(0);
  });

  it('orders cells by how many conditions they pass', () => {
    const cells = conditionCells([
      base,
      row({ cond_billing_unit_survives: true, cond_demand_sink: true, cond_permission_to_act: true }),
    ]);
    expect(cells[0].passes).toBe(3);
  });

  it('excludes rows with any condition uncoded rather than treating null as false', () => {
    const cells = conditionCells([row({ cond_demand_sink: null })]);
    expect(cells.every((c) => c.rows.length === 0)).toBe(true);
  });

  it('averages the margin delta only over rows that have one', () => {
    const cells = conditionCells([
      row({ margin_delta_4q_bps: -100 }),
      row({ margin_delta_4q_bps: null }),
      row({ margin_delta_4q_bps: -50 }),
    ]);
    const cell = cells.find((c) => c.rows.length === 3)!;
    expect(cell.meanMarginDelta4qBps).toBeCloseTo(-75, 5);
  });
});

describe('groupBy', () => {
  it('counts rows and sums money only for gain claims', () => {
    const out = groupBy(
      [row({ destination: 5, claimed_amount_usd: 100, traceable_to_pl_usd: 40 }),
       row({ destination: 5, claimed_amount_usd: 900, claim_kind: 'context' })],
      (r) => r.destination,
    );
    expect(out[0].claims).toBe(2);
    expect(out[0].claimedUsd).toBe(100);
    expect(out[0].unreconciledUsd).toBe(60);
  });
});

describe('toggle', () => {
  it('adds then removes', () => {
    expect(toggle([], 'a')).toEqual(['a']);
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('csv', () => {
  it('quotes cells containing a comma', () => {
    expect(csvCell('IBM, reports')).toBe('"IBM, reports"');
  });
  it('doubles embedded quotes', () => {
    expect(csvCell('the "gain"')).toBe('"the ""gain"""');
  });
  it('quotes cells containing a newline', () => {
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });
  it('renders null and undefined as empty, not as the word null', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
  it('emits a header plus one line per row with CRLF endings', () => {
    const csv = toCsv([base], ['company_name', 'headline']);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('company_name,headline');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Klarna');
  });
});

describe('format', () => {
  it('scales dollars and drops trailing zeros', () => {
    expect(usd(60_000_000)).toBe('$60M');
    expect(usd(3_500_000_000)).toBe('$3.5B');
    expect(usd(2_000_000_000_000)).toBe('$2T');
    expect(usd(1234)).toBe('$1.23K');
  });
  it('renders a missing value as an em dash rather than $0', () => {
    expect(usd(null)).toBe('—');
    expect(usd(undefined)).toBe('—');
    expect(usd(NaN)).toBe('—');
  });
  it('uses a real minus sign for negatives', () => {
    expect(usd(-5_000_000)).toBe('−$5M');
    expect(bps(-35)).toBe('−35bp');
    expect(pct(-12.4)).toBe('−12.4%');
  });
  it('signs positive basis points explicitly, because direction is the point', () => {
    expect(bps(40)).toBe('+40bp');
  });
  it('converts a margin ratio to a percentage', () => {
    expect(ratioAsPct(0.211)).toBe('21.1%');
  });
  it('formats dates as month and year', () => {
    expect(shortDate('2025-11-18')).toBe('Nov 2025');
    expect(shortDate(null)).toBe('—');
  });
  it('renders claimed values in their native unit', () => {
    expect(claimedValue(700, 'fte')).toBe('700 FTE');
    expect(claimedValue(21.2, 'pct')).toBe('21.2%');
    expect(claimedValue(15791, 'hours')).toBe('15,791 hrs');
    expect(claimedValue(null, 'usd')).toBe('—');
  });
});

describe('sourceLinks', () => {
  it('puts a stored URL first when one exists', () => {
    const links = sourceLinks(row({ source_url: 'https://example.com/x' }));
    expect(links[0].href).toBe('https://example.com/x');
  });

  it('offers EDGAR links for public filers even without a stored URL', () => {
    const labels = sourceLinks(base).map((l) => l.label);
    expect(labels).toContain('EDGAR filings');
    expect(labels).toContain('EDGAR full text');
  });

  it('offers Scholar for peer-reviewed rows', () => {
    const links = sourceLinks(row({ source_type: 'peer_reviewed', company_is_public: false, company_ticker: null }));
    expect(links.some((l) => l.href.includes('scholar.google'))).toBe(true);
  });

  it('returns nothing to click for a private company with no URL, rather than a fabricated link', () => {
    expect(sourceLinks(row({ company_is_public: false, company_ticker: null, source_url: null, source_type: 'press' }))).toEqual([]);
  });

  it('builds a quoted EDGAR full-text query', () => {
    const url = edgarFullTextSearch('productivity savings', 'IBM');
    expect(url).toContain('edgar/search');
    expect(decodeURIComponent(url)).toContain('"productivity savings"');
    expect(url).not.toContain('+'); // "+" is not decoded as a space in a hash route
  });

  it('strips stop words so full-text search actually returns something', () => {
    expect(searchPhrase(base)).toBe('firm $60m saved ai agent');
  });
});
