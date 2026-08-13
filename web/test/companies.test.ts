import { describe, expect, it } from 'vitest';
import { buildProfiles, findProfile, unanimous, verdict } from '../src/lib/companies';
import { CORPUS, row } from './fixtures';

describe('unanimous', () => {
  it('returns the value when every coded row agrees', () => {
    expect(unanimous([true, true, null])).toBe(true);
    expect(unanimous([false, false])).toBe(false);
  });
  it('returns null when rows disagree, rather than picking a winner', () => {
    expect(unanimous([true, false])).toBeNull();
  });
  it('returns null when nothing is coded', () => {
    expect(unanimous([null, null])).toBeNull();
  });
});

describe('buildProfiles', () => {
  const profiles = buildProfiles(CORPUS);

  it('produces one profile per company, not per claim', () => {
    expect(profiles).toHaveLength(5);
    expect(findProfile(profiles, 'klarna')!.rows).toHaveLength(2);
  });

  it('sums only gain claims into the company money figures', () => {
    const chegg = findProfile(profiles, 'chegg')!;
    expect(chegg.claimedUsd).toBe(0);
    expect(chegg.rows).toHaveLength(1);
  });

  it('computes the untraced figure from claimed minus traced', () => {
    const klarna = findProfile(profiles, 'klarna')!;
    expect(klarna.claimedUsd).toBe(88_000_000);
    expect(klarna.tracedUsd).toBe(28_000_000);
    expect(klarna.untracedUsd).toBe(60_000_000);
  });

  it('picks the destination most of the gain claims landed in', () => {
    const ibm = findProfile(profiles, 'ibm')!;
    expect(ibm.dominantDestination).toBe(1);
  });

  it('reports conditions as null when the company rows disagree', () => {
    const klarna = findProfile(profiles, 'klarna')!;
    expect(klarna.conditions.billing).toBeNull();
    expect(klarna.conditionsPassed).toBeNull();
  });

  it('reports all three met when every row agrees', () => {
    const ibm = findProfile(profiles, 'ibm')!;
    expect(ibm.conditionsPassed).toBe(3);
  });

  it('separates counter-evidence from gain claims', () => {
    const chegg = findProfile(profiles, 'chegg')!;
    expect(chegg.gains).toHaveLength(0);
    expect(chegg.counterEvidence).toHaveLength(1);
  });

  it('builds the reverse index of who absorbed a loss for whom', () => {
    const withCx = buildProfiles([
      ...CORPUS,
      row({ ref: 'cx', company_slug: 'concentrix', company_name: 'Concentrix' }),
    ]);
    const cx = findProfile(withCx, 'concentrix')!;
    expect(cx.absorbedFrom).toHaveLength(1);
    expect(cx.absorbedFrom[0].name).toBe('MIT NANDA');
    expect(cx.absorbedFrom[0].amountUsd).toBe(130_000_000);
  });

  it('takes the margin figure from the most recent claim that has one', () => {
    const klarna = findProfile(profiles, 'klarna')!;
    expect(klarna.marginDelta4qBps).toBe(45);
  });

  it('returns null rather than throwing for an unknown slug', () => {
    expect(findProfile(profiles, 'nope')).toBeNull();
  });
});

describe('verdict', () => {
  const profiles = buildProfiles(CORPUS);

  it('states the count, the money and the destination', () => {
    const v = verdict(findProfile(profiles, 'ibm')!);
    expect(v).toMatch(/1 gain claim/);
    expect(v).toMatch(/\$3\.5B/);
    expect(v).toMatch(/absorbed as slack/);
  });

  it('says plainly when nothing is traceable', () => {
    expect(verdict(findProfile(profiles, 'ibm')!)).toMatch(/None of it can be matched/);
  });

  it('splits the figure when a company is partly traceable', () => {
    const v = verdict(findProfile(profiles, 'klarna')!);
    expect(v).toMatch(/\$28M of it is matched/);
    expect(v).toMatch(/\$60M is not/);
  });

  it('says "most of it" only when destinations are mixed', () => {
    expect(verdict(findProfile(profiles, 'klarna')!)).toMatch(/Most of it/);
    expect(verdict(findProfile(profiles, 'ibm')!)).not.toMatch(/Most of it/);
  });

  it('handles a company with no gain claims without inventing one', () => {
    const v = verdict(findProfile(profiles, 'chegg')!);
    expect(v).toMatch(/not a claim that AI produced a gain/);
    expect(v).not.toMatch(/\$2T/);
  });

  it('reports a measured margin movement with a direction', () => {
    expect(verdict(findProfile(profiles, 'klarna')!)).toMatch(/\+45bp — wider/);
  });

  it('says the margin is unavailable rather than showing a zero', () => {
    expect(verdict(findProfile(profiles, 'ibm')!)).toMatch(/No measured margin movement/);
  });

  it('flags a countervailing observation', () => {
    expect(verdict(findProfile(profiles, 'ibm')!)).toMatch(/moved the other way/);
  });
});
