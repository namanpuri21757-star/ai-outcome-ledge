import { describe, expect, it } from 'vitest';
import { applyChip, chipActive, chipLabel, chipTitle, chipTone, type ChipTarget } from '../src/lib/chips';
import { EMPTY_FILTERS, type Filters } from '../src/lib/filters';

const f = (patch: Partial<Filters> = {}): Filters => ({ ...EMPTY_FILTERS, ...patch });

const ALL: ChipTarget[] = [
  { kind: 'destination', rank: 5 },
  { kind: 'basis', basis: 'net_pl' },
  { kind: 'condition', key: 'billing' },
  { kind: 'conditionCount', count: 3 },
  { kind: 'sector', sector: 'Banking' },
  { kind: 'group', code: 'D' },
  { kind: 'company', slug: 'ibm', name: 'IBM' },
];

describe('chipLabel', () => {
  it('reads as words, never as a database code', () => {
    expect(chipLabel({ kind: 'destination', rank: 5 })).toBe('Kept as margin');
    expect(chipLabel({ kind: 'destination', rank: 1 })).toBe('Absorbed as slack');
    expect(chipLabel({ kind: 'basis', basis: 'gross_capacity' })).toBe('Hours freed');
    expect(chipLabel({ kind: 'group', code: 'D' })).toBe('Large incumbent');
  });

  it('never prints a bare numeral for a rank', () => {
    for (const rank of [0, 1, 2, 3, 4, 5]) {
      expect(chipLabel({ kind: 'destination', rank })).not.toMatch(/^\d/);
    }
  });

  it('says all three met rather than 3 of three', () => {
    expect(chipLabel({ kind: 'conditionCount', count: 3 })).toBe('All three met');
    expect(chipLabel({ kind: 'conditionCount', count: 1 })).toBe('1 of three met');
  });

  it('gives every kind a non-empty label and title', () => {
    for (const t of ALL) {
      expect(chipLabel(t).length).toBeGreaterThan(0);
      expect(chipTitle(t).length).toBeGreaterThan(0);
    }
  });
});

describe('applyChip', () => {
  it('adds the value to the selection', () => {
    expect(applyChip({ kind: 'destination', rank: 5 }, f()).destinations).toEqual([5]);
    expect(applyChip({ kind: 'basis', basis: 'net_pl' }, f()).bases).toEqual(['net_pl']);
    expect(applyChip({ kind: 'sector', sector: 'Banking' }, f()).sectors).toEqual(['Banking']);
    expect(applyChip({ kind: 'company', slug: 'ibm', name: 'IBM' }, f()).companies).toEqual(['ibm']);
  });

  it('toggles off on a second click, so the way back is the way in', () => {
    for (const t of ALL) {
      const on = applyChip(t, f());
      expect(chipActive(t, on)).toBe(true);
      const off = applyChip(t, on);
      expect(chipActive(t, off)).toBe(false);
    }
  });

  it('accumulates rather than replacing, so two destinations can both be held', () => {
    const one = applyChip({ kind: 'destination', rank: 1 }, f());
    const two = applyChip({ kind: 'destination', rank: 5 }, one);
    expect(two.destinations.sort()).toEqual([1, 5]);
  });

  it('leaves every other part of the selection untouched', () => {
    const before = f({ search: 'klarna', companies: ['klarna'], dollarsOnly: true });
    const after = applyChip({ kind: 'destination', rank: 5 }, before);
    expect(after.search).toBe('klarna');
    expect(after.companies).toEqual(['klarna']);
    expect(after.dollarsOnly).toBe(true);
  });

  it('does not mutate the selection it was given', () => {
    const before = f();
    applyChip({ kind: 'destination', rank: 5 }, before);
    expect(before.destinations).toEqual([]);
  });

  it('treats uncoded as a real, selectable value', () => {
    expect(applyChip({ kind: 'destination', rank: 0 }, f()).destinations).toEqual([0]);
  });
});

describe('chipActive', () => {
  it('reports the current state for every kind', () => {
    expect(chipActive({ kind: 'destination', rank: 5 }, f({ destinations: [5] }))).toBe(true);
    expect(chipActive({ kind: 'destination', rank: 5 }, f({ destinations: [1] }))).toBe(false);
    expect(chipActive({ kind: 'conditionCount', count: 3 }, f({ conditionCounts: [3] }))).toBe(true);
    expect(chipActive({ kind: 'condition', key: 'sink' }, f({ conditionsMet: ['sink'] }))).toBe(true);
  });
});

describe('chipTone', () => {
  it('carries the destination accent so the chip matches the ladder', () => {
    expect(chipTone({ kind: 'destination', rank: 5 })).toBe('tone-margin');
    expect(chipTone({ kind: 'destination', rank: 1 })).toBe('tone-slack');
  });

  it('marks the all-three cohort, which is the one that converts', () => {
    expect(chipTone({ kind: 'conditionCount', count: 3 })).toBe('tone-margin');
    expect(chipTone({ kind: 'conditionCount', count: 2 })).toBe('');
  });

  it('leaves neutral kinds unaccented', () => {
    expect(chipTone({ kind: 'company', slug: 'ibm', name: 'IBM' })).toBe('');
  });
});
