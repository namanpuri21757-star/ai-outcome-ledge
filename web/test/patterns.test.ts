import { describe, expect, it } from 'vitest';
import { row } from './fixtures';
import { buildProfiles } from '../src/lib/companies';
import {
  groupProfiles, marginSeries, relatedSlugs, relationReason, sortProfiles,
} from '../src/lib/patterns';
import type { LedgerRow } from '../src/lib/types';
import { DESTINATION_ORDER } from '../src/lib/labels';

/** A company with the shape a test cares about and nothing else. */
function company(
  slug: string,
  patch: Partial<LedgerRow> = {},
  extra: LedgerRow[] = [],
): LedgerRow[] {
  return [
    row({
      ref: `${slug}-1`,
      company_slug: slug,
      company_name: slug.toUpperCase(),
      claim_kind: 'gain_claim',
      claimed_amount_usd: 1_000_000,
      traceable_to_pl_usd: 0,
      ...patch,
    }),
    ...extra,
  ];
}

const profiles = (rows: LedgerRow[]) => buildProfiles(rows);

describe('groupProfiles — by destination', () => {
  const rows = [
    ...company('a', { destination: 1, claimed_amount_usd: 500 }),
    ...company('b', { destination: 1, claimed_amount_usd: 300 }),
    ...company('c', { destination: 5, claimed_amount_usd: 200 }),
    ...company('d', { destination: 0, claimed_amount_usd: 100 }),
  ];

  it('puts companies that landed in the same place together', () => {
    const groups = groupProfiles(profiles(rows), 'destination');
    const slack = groups.find((g) => g.key === 'dest:1');
    expect(slack?.members.map((m) => m.slug).sort()).toEqual(['a', 'b']);
  });

  it('orders buckets by the ladder, not by size', () => {
    // Slack has two members and margin has one. Bucket order still
    // follows DESTINATION_ORDER, the same order the flow diagram reads
    // top to bottom, so position means the same thing in both views.
    const keys = groupProfiles(profiles(rows), 'destination').map((g) => g.key);
    expect(keys.indexOf('dest:1')).toBeLessThan(keys.indexOf('dest:5'));
  });

  it('uses exactly the ladder order the flow diagram uses', () => {
    const rows2 = DESTINATION_ORDER.filter((r) => r > 0).map((rank, i) =>
      company(`c${rank}`, { destination: rank, claimed_amount_usd: 100 + i })[0],
    );
    const keys = groupProfiles(profiles(rows2), 'destination').map((g) => g.key);
    expect(keys).toEqual(DESTINATION_ORDER.filter((r) => r > 0).map((r) => `dest:${r}`));
  });

  it('gives uncoded its own bucket, last, marked unknown', () => {
    const groups = groupProfiles(profiles(rows), 'destination');
    const last = groups[groups.length - 1];
    // Rank 0 is a coded value meaning "not coded", and companies with no
    // gain claim at all fall to the null bucket.
    expect(last.unknown || last.key === 'dest:0').toBe(true);
  });

  it('totals claimed and untraced per bucket', () => {
    const slack = groupProfiles(profiles(rows), 'destination').find((g) => g.key === 'dest:1');
    expect(slack?.claimedUsd).toBe(800);
    expect(slack?.untracedUsd).toBe(800);
  });
});

describe('groupProfiles — by condition count', () => {
  const rows = [
    ...company('all3', {
      cond_billing_unit_survives: true, cond_demand_sink: true, cond_permission_to_act: true,
    }),
    ...company('two', {
      cond_billing_unit_survives: true, cond_demand_sink: true, cond_permission_to_act: false,
    }),
    ...company('partial', {
      cond_billing_unit_survives: true, cond_demand_sink: null, cond_permission_to_act: true,
    }),
  ];

  it('separates the cohort that meets all three', () => {
    const g = groupProfiles(profiles(rows), 'conditions').find((x) => x.key === 'cond:3');
    expect(g?.members.map((m) => m.slug)).toEqual(['all3']);
    expect(g?.label).toBe('All three conditions met');
  });

  it('puts all-three first, because that is the cohort that converts', () => {
    expect(groupProfiles(profiles(rows), 'conditions')[0].key).toBe('cond:3');
  });

  it('does not count an uncoded condition as a failed one', () => {
    const groups = groupProfiles(profiles(rows), 'conditions');
    // "partial" has two true and one unknown. It must not land in the
    // 2-of-3 bucket beside a company genuinely tested and failed.
    expect(groups.find((g) => g.key === 'cond:2')?.members.map((m) => m.slug)).toEqual(['two']);
    expect(groups.find((g) => g.key === 'cond:none')?.members.map((m) => m.slug)).toEqual(['partial']);
  });

  it('says why the uncoded bucket exists', () => {
    const g = groupProfiles(profiles(rows), 'conditions').find((x) => x.key === 'cond:none');
    expect(g?.meaning).toMatch(/uncoded condition is not a failed one/);
    expect(g?.unknown).toBe(true);
  });
});

describe('groupProfiles — sector and ungrouped', () => {
  const rows = [
    ...company('a', { sector: 'Banking' }),
    ...company('b', { sector: 'Banking' }),
    ...company('c', { sector: null }),
  ];

  it('groups by sector and gives the missing one its own bucket', () => {
    const groups = groupProfiles(profiles(rows), 'sector');
    expect(groups.find((g) => g.key === 'sector:Banking')?.members).toHaveLength(2);
    expect(groups.find((g) => g.key === 'sector:none')?.unknown).toBe(true);
  });

  it('returns one bucket holding everyone when ungrouped', () => {
    const groups = groupProfiles(profiles(rows), 'none');
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(3);
  });

  it('returns nothing for no companies rather than an empty bucket', () => {
    expect(groupProfiles([], 'destination')).toEqual([]);
  });
});

describe('sortProfiles', () => {
  const rows = [
    ...company('big', { claimed_amount_usd: 900, margin_delta_4q_bps: 10 }),
    ...company('small', { claimed_amount_usd: 100, margin_delta_4q_bps: 90 }),
    ...company('none', { claimed_amount_usd: 400 }),
  ];
  const ps = profiles(rows);

  it('sorts by claimed, largest first', () => {
    expect(sortProfiles(ps, 'claimed').map((p) => p.slug)).toEqual(['big', 'none', 'small']);
  });

  it('sorts by name alphabetically', () => {
    expect(sortProfiles(ps, 'name').map((p) => p.slug)).toEqual(['big', 'none', 'small']);
  });

  it('sorts unmeasured margins last, never first', () => {
    const order = sortProfiles(ps, 'margin').map((p) => p.slug);
    expect(order[order.length - 1]).toBe('none');
    expect(order[0]).toBe('small');
  });

  it('does not mutate the array it was given', () => {
    const before = ps.map((p) => p.slug);
    sortProfiles(ps, 'name');
    expect(ps.map((p) => p.slug)).toEqual(before);
  });
});

describe('marginSeries', () => {
  it('returns readings oldest first', () => {
    const rows = company('x', { claim_date: '2025-01-01', margin_delta_4q_bps: 5 }, [
      row({ ref: 'x-2', company_slug: 'x', claim_date: '2024-01-01', margin_delta_4q_bps: 1 }),
      row({ ref: 'x-3', company_slug: 'x', claim_date: '2026-01-01', margin_delta_4q_bps: 9 }),
    ]);
    expect(marginSeries(profiles(rows)[0])).toEqual([1, 5, 9]);
  });

  it('drops unmeasured rows rather than reading them as zero', () => {
    const rows = company('x', { margin_delta_4q_bps: null });
    expect(marginSeries(profiles(rows)[0])).toEqual([]);
  });

  it('keeps a genuine zero, which is a measurement', () => {
    const rows = company('x', { margin_delta_4q_bps: 0 });
    expect(marginSeries(profiles(rows)[0])).toEqual([0]);
  });
});

describe('relatedSlugs', () => {
  const rows = [
    ...company('ibm', {
      destination: 1,
      cond_billing_unit_survives: true, cond_demand_sink: true, cond_permission_to_act: true,
    }),
    ...company('same-dest', {
      destination: 1,
      cond_billing_unit_survives: false, cond_demand_sink: false, cond_permission_to_act: false,
    }),
    ...company('same-count', {
      destination: 5,
      cond_billing_unit_survives: true, cond_demand_sink: true, cond_permission_to_act: true,
    }),
    ...company('unrelated', {
      destination: 4,
      cond_billing_unit_survives: false, cond_demand_sink: false, cond_permission_to_act: false,
    }),
  ];
  const ps = profiles(rows);
  const ibm = ps.find((p) => p.slug === 'ibm')!;

  it('matches on destination or on condition count', () => {
    const related = relatedSlugs(ibm, ps);
    expect(related.has('same-dest')).toBe(true);
    expect(related.has('same-count')).toBe(true);
    expect(related.has('unrelated')).toBe(false);
  });

  it('never includes the company itself', () => {
    expect(relatedSlugs(ibm, ps).has('ibm')).toBe(false);
  });

  it('finds no cohort for a company with neither axis coded', () => {
    const lonely = profiles(company('lonely', { destination: 0 }))[0];
    expect(relatedSlugs(lonely, [lonely, ...ps]).size).toBe(0);
  });

  it('states which axis matched', () => {
    expect(relationReason(ibm, ps.find((p) => p.slug === 'same-dest')!))
      .toBe('absorbed as slack');
    expect(relationReason(ibm, ps.find((p) => p.slug === 'same-count')!))
      .toBe('meets all three conditions');
    expect(relationReason(ibm, ps.find((p) => p.slug === 'unrelated')!)).toBeNull();
  });

  it('names both axes when both matched', () => {
    const twin = profiles([
      ...company('ibm', {
        destination: 1,
        cond_billing_unit_survives: true, cond_demand_sink: true, cond_permission_to_act: true,
      }),
      ...company('twin', {
        destination: 1,
        cond_billing_unit_survives: true, cond_demand_sink: true, cond_permission_to_act: true,
      }),
    ]);
    const reason = relationReason(twin.find((p) => p.slug === 'ibm')!, twin.find((p) => p.slug === 'twin')!);
    expect(reason).toBe('absorbed as slack, meets all three conditions');
  });
});
