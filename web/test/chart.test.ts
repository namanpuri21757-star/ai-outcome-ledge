import { describe, expect, it } from 'vitest';
import {
  indexAtX, linear, marginDomain, nearestIndex, seriesPath, ticks, type SeriesPoint,
} from '../src/lib/chart';

describe('linear', () => {
  it('maps the domain onto the range', () => {
    const s = linear([0, 10], [0, 100]);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
  });

  it('handles an inverted range, which is how a y axis works', () => {
    const s = linear([0, 1], [200, 0]);
    expect(s(0)).toBe(200);
    expect(s(1)).toBe(0);
    expect(s(0.5)).toBe(100);
  });

  it('centres a degenerate domain rather than dividing by zero', () => {
    const s = linear([0.08, 0.08], [100, 0]);
    expect(s(0.08)).toBe(50);
    expect(Number.isNaN(s(0.08))).toBe(false);
  });

  it('inverts', () => {
    const s = linear([0, 10], [0, 100]);
    expect(s.invert(50)).toBe(5);
    expect(s.invert(s(7))).toBeCloseTo(7);
  });
});

describe('marginDomain', () => {
  it('always includes zero, so a move into loss is visible', () => {
    const [lo, hi] = marginDomain([0.08, 0.11, 0.09]);
    expect(lo).toBeLessThanOrEqual(0);
    expect(hi).toBeGreaterThan(0.11);
  });

  it('includes zero from below for a loss-making series', () => {
    const [lo, hi] = marginDomain([-0.04, -0.02]);
    expect(lo).toBeLessThan(-0.04);
    expect(hi).toBeGreaterThanOrEqual(0);
  });

  it('ignores nulls rather than reading them as zero', () => {
    expect(marginDomain([0.1, null, 0.2])).toEqual(marginDomain([0.1, 0.2]));
  });

  it('falls back to a symmetric domain when there is nothing to draw', () => {
    expect(marginDomain([])).toEqual([-0.5, 0.5]);
    expect(marginDomain([null, undefined])).toEqual([-0.5, 0.5]);
  });

  it('pads a flat series by the minimum rather than to a zero-height band', () => {
    const [lo, hi] = marginDomain([0.05, 0.05]);
    expect(hi - lo).toBeGreaterThan(0);
  });
});

describe('ticks', () => {
  it('chooses round values from the 1/2/5 family', () => {
    expect(ticks(0, 1, 4)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('stays near the requested count on a real margin domain', () => {
    // [-2%, 13%] used to yield eight gridlines in a 220px chart.
    expect(ticks(-0.02, 0.13, 4)).toEqual([0, 0.05, 0.1]);
  });

  it('spans a negative-to-positive domain and includes zero exactly', () => {
    const out = ticks(-0.06, 0.06, 4);
    expect(out).toContain(0);
    // No -0, which renders as "-0%".
    expect(out.every((t) => !Object.is(t, -0))).toBe(true);
  });

  it('does not drop the final tick to floating-point drift', () => {
    // 0.1 * 3 !== 0.3 in binary floating point; the last tick used to
    // vanish on domains like this one.
    expect(ticks(0, 0.3, 3)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it('returns nothing for a degenerate or invalid domain', () => {
    expect(ticks(1, 1)).toEqual([]);
    expect(ticks(1, 0)).toEqual([]);
    expect(ticks(NaN, 1)).toEqual([]);
  });
});

const SERIES: SeriesPoint[] = [
  { date: '2025-03-31', margin: 0.08 },
  { date: '2025-06-30', margin: 0.09 },
  { date: '2025-09-30', margin: null },
  { date: '2025-12-31', margin: 0.11 },
];

describe('nearestIndex', () => {
  it('snaps a claim date to the nearest observation', () => {
    expect(nearestIndex(SERIES, '2025-07-02')).toBe(1);
    expect(nearestIndex(SERIES, '2025-12-20')).toBe(3);
  });

  it('is defined at the ends', () => {
    expect(nearestIndex(SERIES, '2019-01-01')).toBe(0);
    expect(nearestIndex(SERIES, '2099-01-01')).toBe(3);
  });

  it('reports no index rather than guessing one', () => {
    expect(nearestIndex([], '2025-01-01')).toBe(-1);
    expect(nearestIndex(SERIES, 'not-a-date')).toBe(-1);
  });
});

describe('indexAtX', () => {
  const x = linear([0, 3], [0, 300]);

  it('finds the point under the pointer', () => {
    expect(indexAtX(4, x, 0)).toBe(0);
    expect(indexAtX(4, x, 100)).toBe(1);
    expect(indexAtX(4, x, 149)).toBe(1);
    expect(indexAtX(4, x, 151)).toBe(2);
  });

  it('clamps outside the plot instead of indexing past the series', () => {
    expect(indexAtX(4, x, -80)).toBe(0);
    expect(indexAtX(4, x, 9999)).toBe(3);
  });

  it('reports no index for an empty series', () => {
    expect(indexAtX(0, x, 10)).toBe(-1);
  });
});

describe('seriesPath', () => {
  const x = linear([0, 3], [0, 300]);
  const y = linear([0, 0.2], [100, 0]);

  it('draws a path', () => {
    expect(seriesPath(SERIES, x, y)).toMatch(/^M/);
  });

  it('breaks the line at a missing observation rather than drawing through it', () => {
    // Two subpaths, because the third quarter was never filed.
    expect(seriesPath(SERIES, x, y).match(/M/g)?.length).toBe(2);
  });

  it('is empty for an empty series', () => {
    expect(seriesPath([], x, y)).toBe('');
  });

  it('never emits NaN into the d attribute', () => {
    const flat = linear([0.05, 0.05], [100, 0]);
    expect(seriesPath(SERIES, x, flat)).not.toMatch(/NaN/);
  });
});
