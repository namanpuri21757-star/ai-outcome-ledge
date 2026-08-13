import { describe, expect, it } from 'vitest';
import {
  BASES, CONDITION_LIST, DESTINATIONS, DESTINATION_ORDER, KINDS, basis, destination, group,
} from '../src/lib/labels';

describe('the vocabulary', () => {
  it('gives every destination a name with no leading digit', () => {
    for (const d of Object.values(DESTINATIONS)) {
      expect(d.name).not.toMatch(/^\d/);
      expect(d.name.length).toBeGreaterThan(3);
    }
  });

  it('keeps the rank so ordering survives the rename', () => {
    expect(DESTINATIONS[5].rank).toBe(5);
    expect(DESTINATIONS[1].rank).toBe(1);
  });

  it('orders the destinations by distance from profit, uncoded last', () => {
    expect(DESTINATION_ORDER).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it('names margin as the only destination that is profit', () => {
    expect(DESTINATIONS[5].name).toMatch(/margin/i);
    expect(DESTINATIONS[1].name).toMatch(/slack/i);
  });

  it('gives every destination a verb phrase that reads after a company name', () => {
    for (const d of Object.values(DESTINATIONS)) {
      expect(`Its gains were ${d.verb}.`).toMatch(/^Its gains were \S/);
    }
  });

  it('falls back to uncoded rather than throwing on a bad rank', () => {
    expect(destination(99).rank).toBe(0);
    expect(destination(null).rank).toBe(0);
  });

  it('explains every measurement basis in a full sentence', () => {
    for (const b of Object.values(BASES)) {
      expect(b.meaning.length).toBeGreaterThan(30);
      expect(b.meaning.trim().endsWith('.')).toBe(true);
    }
  });

  it('marks capacity-style bases as soft and a moved line item as hard', () => {
    expect(BASES.gross_capacity.soft).toBe(true);
    expect(BASES.net_pl.soft).toBe(false);
  });

  it('falls back to the undefined basis for an unknown key', () => {
    expect(basis('nope' as never).name).toBe(BASES.unverified.name);
  });

  it('gives each condition a question and both outcomes', () => {
    expect(CONDITION_LIST).toHaveLength(3);
    for (const c of CONDITION_LIST) {
      expect(c.question.endsWith('?')).toBe(true);
      expect(c.passes.length).toBeGreaterThan(20);
      expect(c.fails.length).toBeGreaterThan(20);
    }
  });

  it('explains every row kind', () => {
    for (const k of Object.values(KINDS)) expect(k.meaning.length).toBeGreaterThan(20);
  });

  it('names an unknown company group rather than showing a bare code', () => {
    expect(group('Z').name).toBe('Unclassified');
    expect(group('C').name).toBe('Platform vendor');
  });
});
