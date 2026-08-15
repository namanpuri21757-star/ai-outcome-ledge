import { describe, expect, it } from 'vitest';
import {
  activeFilterChips, applyFilters, EMPTY_FILTERS, filterOptions, isFilterActive,
  matchesSearch, sortRows, toggle, type Filters,
} from '../src/lib/filters';
import { BASIS_ORDER, DESTINATION_ORDER, KIND_ORDER, VERIFICATION_ORDER } from '../src/lib/labels';
import { CORPUS, row } from './fixtures';

const f = (patch: Partial<Filters> = {}): Filters => ({ ...EMPTY_FILTERS, ...patch });

describe('applyFilters', () => {
  it('returns everything for an empty selection', () => {
    expect(applyFilters(CORPUS, EMPTY_FILTERS)).toHaveLength(CORPUS.length);
  });

  it('combines dimensions with AND, not OR', () => {
    const both = applyFilters(CORPUS, f({ destinations: [5], dollarsOnly: true }));
    expect(both.every((r) => r.destination === 5 && (r.claimed_amount_usd ?? 0) > 0)).toBe(true);
    // Chegg is coded to destination 5 but names no dollar figure, so
    // the two filters together must return fewer rows than either alone.
    expect(both.length).toBeLessThan(applyFilters(CORPUS, f({ destinations: [5] })).length);
    expect(both.length).toBeLessThan(applyFilters(CORPUS, f({ dollarsOnly: true })).length);
  });

  it('combines values inside one dimension with OR', () => {
    const two = applyFilters(CORPUS, f({ destinations: [1, 5] }));
    expect(two.length).toBe(
      applyFilters(CORPUS, f({ destinations: [1] })).length +
        applyFilters(CORPUS, f({ destinations: [5] })).length,
    );
  });

  it('treats a $0 claim as not stated in dollars', () => {
    const rows = [row({ claimed_amount_usd: 0 }), row({ ref: 'b', claimed_amount_usd: 5 })];
    expect(applyFilters(rows, f({ dollarsOnly: true }))).toHaveLength(1);
  });

  it('excludes a row with no group code from a group filter rather than including it', () => {
    const rows = [row({ group_code: null }), row({ ref: 'b', group_code: 'D' })];
    expect(applyFilters(rows, f({ groups: ['D'] }))).toHaveLength(1);
  });

  it('can produce an empty result, and does so without throwing', () => {
    expect(applyFilters(CORPUS, f({ search: 'zzzznothingmatches' }))).toEqual([]);
    expect(applyFilters(CORPUS, f({ destinations: [2] }))).toEqual([]);
  });

  it('filters by verification status', () => {
    expect(applyFilters(CORPUS, f({ verification: ['disputed'] }))).toHaveLength(1);
  });
});

describe('search', () => {
  it('requires every term, not any of them', () => {
    const r = row({ headline: 'IBM reports productivity savings' });
    expect(matchesSearch(r, 'ibm savings')).toBe(true);
    expect(matchesSearch(r, 'ibm nonsense')).toBe(false);
  });

  it('is case-insensitive and ignores extra whitespace', () => {
    expect(matchesSearch(row({ headline: 'Klarna Marketing' }), '  KLARNA   marketing ')).toBe(true);
  });

  it('matches an empty search against everything', () => {
    expect(matchesSearch(row(), '')).toBe(true);
    expect(matchesSearch(row(), '   ')).toBe(true);
  });

  it('searches the resolved label as well as the stored code', () => {
    // "Absorbed as slack" is the label for destination 1.
    expect(matchesSearch(row({ destination: 1 }), 'absorbed slack')).toBe(true);
  });

  it('searches the coding notes, not just the headline', () => {
    expect(matchesSearch(row({ reconciliation_note: 'matched to opex' }), 'opex')).toBe(true);
  });
});

describe('active filter chips', () => {
  it('reports nothing active for a clean selection', () => {
    expect(isFilterActive(EMPTY_FILTERS)).toBe(false);
    expect(activeFilterChips(EMPTY_FILTERS)).toEqual([]);
  });

  it('labels every chip in words, never in a stored code', () => {
    const chips = activeFilterChips(
      f({ destinations: [5], bases: ['net_pl'], kinds: ['gain_claim'], verification: ['disputed'] }),
    );
    for (const c of chips) {
      expect(c.label).not.toMatch(/^\d/);
      expect(c.label).not.toContain('_');
    }
    expect(chips.map((c) => c.label)).toContain('Kept as margin');
  });

  it('removes only its own value and leaves the rest of the selection', () => {
    const before = f({ destinations: [1, 5], kinds: ['gain_claim'] });
    const chip = activeFilterChips(before).find((c) => c.id === 'dest:1')!;
    const after = chip.clear(before);
    expect(after.destinations).toEqual([5]);
    expect(after.kinds).toEqual(['gain_claim']);
  });

  it('counts whitespace-only search as not a filter', () => {
    expect(isFilterActive(f({ search: '   ' }))).toBe(false);
  });
});

describe('sortRows: nulls are a real state', () => {
  const rows = [
    row({ ref: 'a', claimed_amount_usd: 100 }),
    row({ ref: 'b', claimed_amount_usd: null }),
    row({ ref: 'c', claimed_amount_usd: 5 }),
  ];

  it('sorts a missing figure last descending', () => {
    expect(sortRows(rows, 'claimed_amount_usd', 'desc').map((r) => r.ref)).toEqual(['a', 'c', 'b']);
  });

  it('sorts a missing figure last ascending too — it is not the smallest value', () => {
    expect(sortRows(rows, 'claimed_amount_usd', 'asc').map((r) => r.ref)).toEqual(['c', 'a', 'b']);
  });

  it('breaks ties by reference so the order is stable across renders', () => {
    const tied = [row({ ref: 'z', claimed_amount_usd: 1 }), row({ ref: 'a', claimed_amount_usd: 1 })];
    expect(sortRows(tied, 'claimed_amount_usd', 'desc').map((r) => r.ref)).toEqual(['a', 'z']);
  });

  it('does not mutate its input', () => {
    const original = rows.map((r) => r.ref);
    sortRows(rows, 'claimed_amount_usd', 'asc');
    expect(rows.map((r) => r.ref)).toEqual(original);
  });
});

describe('filterOptions', () => {
  const options = filterOptions(CORPUS, {
    kinds: KIND_ORDER,
    destinations: DESTINATION_ORDER,
    bases: BASIS_ORDER,
    verification: VERIFICATION_ORDER,
  });

  it('only offers values that exist in the corpus', () => {
    // Nothing in the fixture is coded "Kept as quality".
    expect(options.destinations.map((o) => o.value)).not.toContain(2);
  });

  it('counts the rows behind each value', () => {
    const margin = options.destinations.find((o) => o.value === 5)!;
    expect(margin.count).toBe(CORPUS.filter((r) => r.destination === 5).length);
  });

  it('keeps the known order rather than sorting by count', () => {
    const present = DESTINATION_ORDER.filter((d) => CORPUS.some((r) => r.destination === d));
    expect(options.destinations.map((o) => o.value)).toEqual(present);
  });

  it('offers nothing at all for an empty corpus', () => {
    const empty = filterOptions([], {
      kinds: KIND_ORDER, destinations: DESTINATION_ORDER,
      bases: BASIS_ORDER, verification: VERIFICATION_ORDER,
    });
    expect(empty.kinds).toEqual([]);
    expect(empty.destinations).toEqual([]);
  });
});

describe('toggle', () => {
  it('adds a value that is absent and removes one that is present', () => {
    expect(toggle([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggle([1, 2], 2)).toEqual([1]);
  });
  it('does not mutate', () => {
    const list = [1];
    toggle(list, 2);
    expect(list).toEqual([1]);
  });
});
