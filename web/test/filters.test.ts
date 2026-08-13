import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS, activeFilterChips, applyFilters, conditionCells, groupBy, isFilterActive,
  matchesSearch, sortRows, toggle, totals, transferEdges,
} from '../src/lib/filters';
import { CORPUS, row } from './fixtures';

describe('matchesSearch', () => {
  it('requires every term, not the exact phrase', () => {
    const r = row({ company_name: 'International Business Machines', headline: 'productivity savings' });
    expect(matchesSearch(r, 'machines savings')).toBe(true);
    expect(matchesSearch(r, 'machines rocket')).toBe(false);
  });

  it('matches on the plain-English destination name, not just the code', () => {
    const r = row({ destination: 1 });
    expect(matchesSearch(r, 'absorbed as slack')).toBe(true);
  });

  it('matches on the measurement basis label', () => {
    expect(matchesSearch(row({ measurement_basis: 'gross_capacity' }), 'hours freed')).toBe(true);
  });

  it('is case insensitive and ignores extra whitespace', () => {
    expect(matchesSearch(row({ company_name: 'Klarna' }), '  KLARNA  ')).toBe(true);
  });

  it('matches everything on an empty query', () => {
    expect(matchesSearch(row(), '')).toBe(true);
  });
});

describe('applyFilters', () => {
  it('returns everything when no filter is set', () => {
    expect(applyFilters(CORPUS, EMPTY_FILTERS)).toHaveLength(CORPUS.length);
  });

  it('filters by destination', () => {
    const out = applyFilters(CORPUS, { ...EMPTY_FILTERS, destinations: [1] });
    expect(out.map((r) => r.ref).sort()).toEqual(['ibm-slack', 'klarna-60m']);
  });

  it('combines filters with AND, not OR', () => {
    const out = applyFilters(CORPUS, { ...EMPTY_FILTERS, destinations: [1], groups: ['D'] });
    expect(out.map((r) => r.ref)).toEqual(['klarna-60m']);
  });

  it('filters to rows a supplier absorbed', () => {
    const out = applyFilters(CORPUS, { ...EMPTY_FILTERS, counterpartyOnly: true });
    expect(out.map((r) => r.ref)).toEqual(['nanda-bpo']);
  });

  it('filters to rows carrying a dollar figure', () => {
    const out = applyFilters(CORPUS, { ...EMPTY_FILTERS, dollarsOnly: true });
    expect(out.every((r) => r.claimed_amount_usd)).toBe(true);
    expect(out).toHaveLength(4);
  });

  it('applies date bounds inclusively', () => {
    const out = applyFilters(CORPUS, { ...EMPTY_FILTERS, from: '2025-01-01', to: '2025-12-31' });
    expect(out.map((r) => r.ref).sort()).toEqual(['klarna-60m', 'klarna-marketing', 'nanda-bpo']);
  });

  it('treats unverifiedOnly as "not primary-sourced"', () => {
    const out = applyFilters(CORPUS, { ...EMPTY_FILTERS, unverifiedOnly: true });
    expect(out.map((r) => r.ref).sort()).toEqual(['cursor-unusable', 'ibm-slack']);
  });
});

describe('activeFilterChips', () => {
  it('produces nothing when no filter is set, so the strip stays hidden', () => {
    expect(activeFilterChips(EMPTY_FILTERS)).toEqual([]);
    expect(isFilterActive(EMPTY_FILTERS)).toBe(false);
  });

  it('names a destination in plain words rather than by its code', () => {
    const chips = activeFilterChips({ ...EMPTY_FILTERS, destinations: [5] });
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toBe('kept as margin');
    expect(chips[0].label).not.toMatch(/5/);
  });

  it('removes exactly one value and leaves the rest intact', () => {
    const f = { ...EMPTY_FILTERS, destinations: [1, 5], search: 'ibm' };
    const chip = activeFilterChips(f).find((c) => c.id === 'dest-1')!;
    const next = chip.clear(f);
    expect(next.destinations).toEqual([5]);
    expect(next.search).toBe('ibm');
  });

  it('produces one chip per active value across every dimension', () => {
    const chips = activeFilterChips({
      ...EMPTY_FILTERS, search: 'x', destinations: [1, 2], groups: ['D'],
      counterpartyOnly: true, dollarsOnly: true,
    });
    expect(chips.map((c) => c.id)).toEqual([
      'search', 'dest-1', 'dest-2', 'group-D', 'counterparty', 'dollars',
    ]);
  });
});

describe('totals', () => {
  it('counts only gain claims toward the money, so a $2T market cap cannot drown it', () => {
    const t = totals(CORPUS);
    expect(t.claimedUsd).toBe(3_500_000_000 + 28_000_000 + 60_000_000);
    expect(t.tracedUsd).toBe(28_000_000);
  });

  it('derives the unreconciled figure rather than trusting the stored column', () => {
    const t = totals(CORPUS);
    expect(t.unreconciledUsd).toBe(t.claimedUsd - t.tracedUsd);
  });

  it('counts distinct companies, not rows', () => {
    expect(totals(CORPUS).companies).toBe(5);
    expect(totals(CORPUS).claims).toBe(6);
  });

  it('returns a null percentage rather than dividing by zero', () => {
    expect(totals([]).reconciledPct).toBeNull();
  });
});

describe('sortRows', () => {
  it('puts nulls last when descending', () => {
    const out = sortRows(CORPUS, 'margin_delta_4q_bps', 'desc');
    expect(out[0].ref).toBe('klarna-marketing');
    expect(out[out.length - 1].margin_delta_4q_bps).toBeNull();
  });

  it('puts nulls last when ascending too — an absence is not the smallest value', () => {
    const out = sortRows(CORPUS, 'margin_delta_4q_bps', 'asc');
    expect(out[0].ref).toBe('klarna-marketing');
    expect(out[out.length - 1].margin_delta_4q_bps).toBeNull();
  });

  it('does not mutate the input', () => {
    const before = CORPUS.map((r) => r.ref);
    sortRows(CORPUS, 'claimed_amount_usd', 'asc');
    expect(CORPUS.map((r) => r.ref)).toEqual(before);
  });
});

describe('transferEdges', () => {
  it('builds an edge only where a supplier absorbed the loss', () => {
    const edges = transferEdges(CORPUS);
    expect(edges).toHaveLength(1);
    expect(edges[0].toName).toBe('Concentrix');
    expect(edges[0].amountUsd).toBe(130_000_000);
  });

  it('collapses unnamed counterparties into one node rather than inventing names', () => {
    const edges = transferEdges([
      row({ ref: 'a', company_slug: 'x', counterparty_absorbed: true, counterparty_slug: null }),
      row({ ref: 'b', company_slug: 'x', counterparty_absorbed: true, counterparty_slug: null }),
    ]);
    expect(edges).toHaveLength(1);
    expect(edges[0].claims).toBe(2);
    expect(edges[0].toName).toBe('Unnamed counterparty');
  });
});

describe('conditionCells', () => {
  it('excludes rows with any condition uncoded rather than treating them as false', () => {
    const cells = conditionCells(CORPUS).filter((c) => c.rows.length > 0);
    const counted = cells.reduce((a, c) => a + c.rows.length, 0);
    expect(counted).toBe(3);
  });

  it('sorts the all-three cell first', () => {
    const cells = conditionCells(CORPUS).filter((c) => c.rows.length > 0);
    expect(cells[0].passes).toBe(3);
  });

  it('reports how many rows in a cell actually have a measured margin', () => {
    const cell = conditionCells(CORPUS).find((c) => c.passes === 3)!;
    expect(cell.rows).toHaveLength(2);
    expect(cell.measured).toBe(1);
    expect(cell.meanMarginDelta4qBps).toBe(45);
  });

  it('reports a null mean rather than zero when nothing is measured', () => {
    const cell = conditionCells(CORPUS).find((c) => c.passes === 0)!;
    expect(cell.rows).toHaveLength(1);
    expect(cell.meanMarginDelta4qBps).toBeNull();
  });
});

describe('groupBy and toggle', () => {
  it('groups and keeps money out of non-gain rows', () => {
    const g = groupBy(CORPUS, (r) => r.company_slug);
    const chegg = g.find((x) => x.key === 'chegg')!;
    expect(chegg.claims).toBe(1);
    expect(chegg.claimedUsd).toBe(0);
  });

  it('toggles a value in and out', () => {
    expect(toggle([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggle([1, 2, 3], 2)).toEqual([1, 3]);
  });
});

