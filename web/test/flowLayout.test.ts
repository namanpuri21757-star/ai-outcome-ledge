import { describe, expect, it } from 'vitest';
import {
  heightForLanes, LABEL_BLOCK, lanesThatFit, MAX_HEIGHT, MIN_HEIGHT, MIN_NODE_H, NAME_SIZE,
  planFlow, VALUE_SIZE,
} from '../src/lib/flowLayout';

describe('LABEL_BLOCK', () => {
  it('is tall enough for both lines of a node label', () => {
    expect(LABEL_BLOCK).toBeGreaterThanOrEqual(NAME_SIZE + VALUE_SIZE);
  });

  it('is the gap the old constant should have been', () => {
    // The bug: nodePadding was 15 while the label needed about 30.
    expect(LABEL_BLOCK).toBeGreaterThan(15);
  });
});

describe('lanesThatFit / heightForLanes', () => {
  it('round-trip: a height computed for n lanes fits exactly n', () => {
    for (let n = 1; n <= 20; n += 1) {
      expect(lanesThatFit(heightForLanes(n))).toBe(n);
    }
  });

  it('never claims a lane that does not fit', () => {
    for (let h = 0; h <= 1200; h += 7) {
      const n = lanesThatFit(h);
      if (n > 1) expect(heightForLanes(n)).toBeLessThanOrEqual(h);
    }
  });

  it('returns nothing for a nonsense height', () => {
    expect(lanesThatFit(0)).toBe(0);
    expect(lanesThatFit(-40)).toBe(0);
    expect(lanesThatFit(NaN)).toBe(0);
  });

  it('always allows at least one lane in any positive height', () => {
    expect(lanesThatFit(1)).toBe(1);
  });
});

/**
 * The guarantee the whole module exists for. Two labels are centred on
 * their own nodes, so the closest two label blocks can ever come is the
 * node padding; if that is at least one block tall, they cannot touch.
 */
describe('no two labels can touch', () => {
  it('holds for every lane count the planner will produce', () => {
    for (let companies = 1; companies <= 60; companies += 1) {
      for (const [bases, destinations] of [[8, 6], [1, 1], [3, 5], [8, 1]]) {
        const plan = planFlow({ companies, bases, destinations, ceiling: 10 });
        // The lump takes a lane only when something was actually folded.
        const lanes = plan.maxNamed + (companies > plan.maxNamed ? 1 : 0);
        const used = heightForLanes(Math.max(lanes, bases, destinations), plan.nodePadding);

        expect(plan.nodePadding).toBeGreaterThanOrEqual(LABEL_BLOCK);
        expect(used).toBeLessThanOrEqual(plan.height + 0.001);
      }
    }
  });
});

describe('planFlow', () => {
  it('stays inside the height bounds whatever it is given', () => {
    for (const companies of [0, 1, 3, 10, 45, 400]) {
      const plan = planFlow({ companies, bases: 8, destinations: 6, ceiling: 10 });
      expect(plan.height).toBeGreaterThanOrEqual(MIN_HEIGHT);
      expect(plan.height).toBeLessThanOrEqual(MAX_HEIGHT);
    }
  });

  it('never names more companies than the ceiling', () => {
    for (const companies of [11, 12, 20, 45, 400]) {
      expect(planFlow({ companies, bases: 8, destinations: 6, ceiling: 10 }).maxNamed)
        .toBeLessThanOrEqual(10);
    }
  });

  it('deducts the lump lane at the boundary where it first appears', () => {
    // Ten companies fit whole; the eleventh forces a lump, and the lump
    // costs a lane. Getting this wrong reported room for eleven names.
    expect(planFlow({ companies: 10, bases: 1, destinations: 1, ceiling: 10 }).maxNamed).toBe(10);
    expect(planFlow({ companies: 11, bases: 1, destinations: 1, ceiling: 10 }).maxNamed).toBe(10);
  });

  it('names every company when they all fit, and leaves no lump', () => {
    const plan = planFlow({ companies: 4, bases: 6, destinations: 5, ceiling: 10 });
    expect(plan.maxNamed).toBe(4);
  });

  it('sizes to the widest column, not to the company column', () => {
    // Three companies but eight bases still needs eight labelled slots.
    const plan = planFlow({ companies: 3, bases: 8, destinations: 6, ceiling: 10 });
    expect(plan.height).toBeGreaterThanOrEqual(heightForLanes(8, plan.nodePadding));
  });

  it('survives an empty selection', () => {
    const plan = planFlow({ companies: 0, bases: 0, destinations: 0, ceiling: 10 });
    expect(plan.height).toBe(MIN_HEIGHT);
    expect(plan.maxNamed).toBeGreaterThanOrEqual(1);
  });

  it('leaves room for a lane to be visible at all', () => {
    expect(MIN_NODE_H).toBeGreaterThan(0);
  });
});
