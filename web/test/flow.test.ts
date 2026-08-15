import { describe, expect, it } from 'vitest';
import { row, CORPUS } from './fixtures';
import {
  buildFlow,
  columnOrder,
  selectionForNode,
  type FlowNode,
} from '../src/lib/flow';
import { DESTINATION_ORDER } from '../src/lib/labels';

const find = (nodes: FlowNode[], id: string) => nodes.find((n) => n.id === id);
const link = (m: ReturnType<typeof buildFlow>, s: string, t: string) =>
  m.links.find((l) => l.source === s && l.target === t);

describe('buildFlow — what enters the diagram', () => {
  it('counts only gain claims toward the money, as totals() does', () => {
    const m = buildFlow(CORPUS);
    // The $2T market-cap row and the context row must not set the scale.
    expect(m.claimedUsd).toBe(3_500_000_000 + 28_000_000 + 60_000_000);
    expect(m.nonGainRows).toBe(3);
  });

  it('counts gain claims with no dollar figure instead of dropping them', () => {
    const rows = [
      row({ ref: 'a', claim_kind: 'gain_claim', claimed_amount_usd: 1000, traceable_to_pl_usd: 0 }),
      row({ ref: 'b', claim_kind: 'gain_claim', claimed_amount_usd: null }),
      row({ ref: 'c', claim_kind: 'gain_claim', claimed_amount_usd: 0 }),
    ];
    const m = buildFlow(rows);
    expect(m.gainsWithoutAmount).toBe(2);
    expect(m.claimedUsd).toBe(1000);
  });

  it('returns an empty model rather than throwing on no rows', () => {
    const m = buildFlow([]);
    expect(m.nodes).toEqual([]);
    expect(m.links).toEqual([]);
    expect(m.claimedUsd).toBe(0);
    expect(m.untracedUsd).toBe(0);
  });

  it('survives rows that are all unmeasurable', () => {
    const m = buildFlow([row({ claim_kind: 'gain_claim', claimed_amount_usd: null })]);
    expect(m.nodes).toEqual([]);
    expect(m.gainsWithoutAmount).toBe(1);
  });
});

describe('buildFlow — the four columns', () => {
  const m = buildFlow(CORPUS);

  it('runs company → basis → destination → outcome', () => {
    expect(find(m.nodes, 'co:ibm')?.column).toBe('company');
    expect(find(m.nodes, 'basis:gross_capacity')?.column).toBe('basis');
    expect(find(m.nodes, 'dest:1')?.column).toBe('destination');
    expect(find(m.nodes, 'out:untraced')?.column).toBe('outcome');
  });

  it('carries IBM $3.5B through hours-freed into absorbed-as-slack', () => {
    expect(link(m, 'co:ibm', 'basis:gross_capacity')?.value).toBe(3_500_000_000);
    expect(link(m, 'basis:gross_capacity', 'dest:1')?.value).toBe(3_560_000_000);
  });

  it('splits the last stage into traced and untraced', () => {
    // Klarna's $28M is fully traced; IBM's $3.5B and Klarna's $60M are not.
    expect(link(m, 'dest:5', 'out:traced')?.value).toBe(28_000_000);
    expect(link(m, 'dest:1', 'out:untraced')?.value).toBe(3_560_000_000);
    expect(find(m.nodes, 'out:traced')?.traced).toBe(true);
    expect(find(m.nodes, 'out:untraced')?.traced).toBe(false);
  });

  it('makes the outcome column sum to the claimed total', () => {
    expect(m.tracedUsd + m.untracedUsd).toBe(m.claimedUsd);
  });

  it('never lets traced exceed claimed', () => {
    // A row asserting more traced than claimed is a data error; it must
    // not produce a ribbon wider than its own source.
    const m2 = buildFlow([
      row({ ref: 'x', claimed_amount_usd: 100, traceable_to_pl_usd: 500, destination: 5 }),
    ]);
    expect(m2.tracedUsd).toBe(100);
    expect(m2.untracedUsd).toBe(0);
    expect(link(m2, 'dest:5', 'out:untraced')).toBeUndefined();
  });

  it('keeps every ribbon carrying the refs behind it', () => {
    expect(link(m, 'co:ibm', 'basis:gross_capacity')?.refs).toEqual(['ibm-slack']);
    expect(link(m, 'basis:gross_capacity', 'dest:1')?.refs).toEqual(['ibm-slack', 'klarna-60m']);
  });
});

describe('buildFlow — folding the long tail', () => {
  const many = Array.from({ length: 20 }, (_, i) =>
    row({
      ref: `r${i}`,
      company_slug: `co${i}`,
      company_name: `Company ${i}`,
      claimed_amount_usd: (20 - i) * 1_000_000,
      traceable_to_pl_usd: 0,
      destination: 1,
    }),
  );

  it('names the largest and folds the rest into one node', () => {
    const m = buildFlow(many, 5);
    expect(m.companiesFolded).toBe(15);
    expect(find(m.nodes, 'co:co0')?.label).toBe('Company 0');
    expect(find(m.nodes, 'co:__other__')?.label).toBe('15 other companies');
  });

  it('folds by size, keeping the biggest claimants named', () => {
    const m = buildFlow(many, 3);
    const namedIds = m.nodes.filter((n) => n.column === 'company' && !n.aggregate).map((n) => n.id);
    expect(namedIds.sort()).toEqual(['co:co0', 'co:co1', 'co:co2']);
  });

  it('loses no money to the fold', () => {
    const total = many.reduce((a, r) => a + (r.claimed_amount_usd ?? 0), 0);
    expect(buildFlow(many, 3).claimedUsd).toBe(total);
  });

  it('does not fold when everyone fits', () => {
    const m = buildFlow(many, 50);
    expect(m.companiesFolded).toBe(0);
    expect(find(m.nodes, 'co:__other__')).toBeUndefined();
  });
});

describe('columnOrder — the ladder must survive the layout', () => {
  it('orders destinations by distance from profit, not by size', () => {
    const nodes: FlowNode[] = DESTINATION_ORDER.map((rank) => ({
      id: `dest:${rank}`,
      column: 'destination' as const,
      label: '',
      value: 1,
      rank,
    }));
    const shuffled = [...nodes].reverse();
    const sorted = [...shuffled].sort((a, b) => columnOrder(a) - columnOrder(b));
    expect(sorted.map((n) => n.rank)).toEqual(DESTINATION_ORDER);
  });

  it('puts kept-as-margin below passed-to-customers', () => {
    const margin: FlowNode = { id: 'dest:5', column: 'destination', label: '', value: 1, rank: 5 };
    const price: FlowNode = { id: 'dest:4', column: 'destination', label: '', value: 1, rank: 4 };
    expect(columnOrder(price)).toBeLessThan(columnOrder(margin));
  });

  it('puts uncoded last, not first', () => {
    const uncoded: FlowNode = { id: 'dest:0', column: 'destination', label: '', value: 1, rank: 0 };
    const slack: FlowNode = { id: 'dest:1', column: 'destination', label: '', value: 1, rank: 1 };
    expect(columnOrder(slack)).toBeLessThan(columnOrder(uncoded));
  });

  it('puts not-traceable above traceable, mirroring the ladder beside it', () => {
    // Deliberate: "kept as margin" is the bottom rung and supplies
    // nearly all the traced money, so traced belongs at the bottom.
    // The other order draws one enormous crossing across the diagram.
    const t: FlowNode = { id: 'out:traced', column: 'outcome', label: '', value: 1, traced: true };
    const u: FlowNode = { id: 'out:untraced', column: 'outcome', label: '', value: 1, traced: false };
    expect(columnOrder(u)).toBeLessThan(columnOrder(t));
  });
});

describe('selectionForNode', () => {
  it('filters to one company', () => {
    expect(selectionForNode({ id: 'co:ibm', column: 'company', label: 'IBM', value: 1, slug: 'ibm' }))
      .toEqual({ companies: ['ibm'] });
  });

  it('filters to one measurement basis', () => {
    expect(
      selectionForNode({
        id: 'basis:net_pl', column: 'basis', label: '', value: 1, basisKey: 'net_pl',
      }),
    ).toEqual({ bases: ['net_pl'] });
  });

  it('filters to one destination, including uncoded', () => {
    expect(selectionForNode({ id: 'dest:0', column: 'destination', label: '', value: 1, rank: 0 }))
      .toEqual({ destinations: [0] });
  });

  it('does not pretend the aggregate node is a company', () => {
    expect(
      selectionForNode({ id: 'co:__other__', column: 'company', label: '', value: 1, aggregate: true }),
    ).toBeNull();
  });

  it('returns nothing for the outcome column, which is arithmetic not a field', () => {
    expect(
      selectionForNode({ id: 'out:traced', column: 'outcome', label: '', value: 1, traced: true }),
    ).toBeNull();
  });
});
