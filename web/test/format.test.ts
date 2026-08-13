import { describe, expect, it } from 'vitest';
import { bps, claimedValue, clip, pct, ratioAsPct, shortDate, usd } from '../src/lib/format';

describe('usd', () => {
  it('scales to the right magnitude', () => {
    expect(usd(3_500_000_000)).toBe('$3.5B');
    expect(usd(451_000_000)).toBe('$451M');
    expect(usd(28_000_000)).toBe('$28M');
    expect(usd(2_000_000_000_000)).toBe('$2T');
  });
  it('renders an em dash for a missing value rather than $0', () => {
    expect(usd(null)).toBe('—');
    expect(usd(undefined)).toBe('—');
    expect(usd(NaN)).toBe('—');
  });
  it('renders a genuine zero as zero', () => {
    expect(usd(0)).toBe('$0');
  });
  it('marks negatives with a true minus sign', () => {
    expect(usd(-130_000_000)).toBe('−$130M');
  });
});

describe('bps', () => {
  it('signs both directions and rounds', () => {
    expect(bps(45.4)).toBe('+45bp');
    expect(bps(-20)).toBe('−20bp');
  });
  it('distinguishes an absent value from zero', () => {
    expect(bps(null)).toBe('—');
    expect(bps(0)).toBe('0bp');
  });
});

describe('ratioAsPct', () => {
  it('turns a stored ratio into a margin percentage', () => {
    expect(ratioAsPct(0.211)).toBe('21.1%');
    expect(ratioAsPct(-0.05)).toBe('-5.0%');
  });
  it('returns a dash for nothing', () => {
    expect(ratioAsPct(null)).toBe('—');
  });
});

describe('pct and shortDate', () => {
  it('formats percentages with a sign', () => {
    expect(pct(36.5)).toBe('+36.5%');
  });
  it('formats a date as month and year', () => {
    expect(shortDate('2024-12-31')).toBe('Dec 2024');
    expect(shortDate(null)).toBe('—');
  });
  it('returns the raw string for an unparseable date rather than lying', () => {
    expect(shortDate('not-a-date')).toBe('not-a-date');
  });
});

describe('claimedValue', () => {
  it('formats each unit in its own terms', () => {
    expect(claimedValue(700, 'fte')).toBe('700 FTE');
    expect(claimedValue(94, 'pct')).toBe('94%');
    expect(claimedValue(15791, 'hours')).toBe('15,791 hrs');
  });
  it('returns a dash rather than zero for a missing value', () => {
    expect(claimedValue(null, 'pct')).toBe('—');
  });
});

describe('clip', () => {
  it('leaves short text alone', () => {
    expect(clip('short', 20)).toBe('short');
  });
  it('cuts on a word boundary and marks the cut', () => {
    const out = clip('the quick brown fox jumps over the lazy dog', 20);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(21);
    expect(out).not.toMatch(/ …$/);
  });
});
