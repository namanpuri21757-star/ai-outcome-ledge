import { describe, expect, it } from 'vitest';
import { row, CORPUS } from './fixtures';
import {
  buildFlow,
  columnOrder,
  namedCompanies,
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

  it('folds the tail on value share even when the count would allow everyone', () => {
    // 20 companies at 20M down to 1M. A count ceiling of 50 leaves them
    // all room, but the smallest are a rounding error against the
    // largest and a lane apiece says otherwise. Naming stops once the
    // named companies account for most of the money.
    const m = buildFlow(many, 50);
    expect(m.companiesFolded).toBeGreaterThan(0);

    const named = m.nodes.filter((n) => n.column === 'company' && !n.aggregate);
    const namedTotal = named.reduce((a, n) => a + n.value, 0);
    expect(namedTotal / m.claimedUsd).toBeGreaterThanOrEqual(0.85);
  });

  it('does not fold when every company is a comparable size', () => {
    const even = Array.from({ length: 6 }, (_, i) =>
      row({
        ref: `e${i}`,
        company_slug: `even${i}`,
        company_name: `Even ${i}`,
        claimed_amount_usd: 1_000_000,
        traceable_to_pl_usd: 0,
        destination: 1,
      }),
    );
    const m = buildFlow(even, 10);
    expect(m.companiesFolded).toBe(0);
    expect(find(m.nodes, 'co:__other__')).toBeUndefined();
  });

  it('never folds exactly one company, because a lump of one is not a lump', () => {
    // Five companies where the fifth is small enough for the share rule
    // to want to drop it. Folding it alone would trade a named lane for
    // an anonymous one of the same width.
    const nearly = [
      ...Array.from({ length: 4 }, (_, i) =>
        row({
          ref: `n${i}`,
          company_slug: `n${i}`,
          company_name: `N${i}`,
          claimed_amount_usd: 50_000_000,
          traceable_to_pl_usd: 0,
          destination: 1,
        }),
      ),
      row({
        ref: 'tiny',
        company_slug: 'tiny',
        company_name: 'Tiny',
        claimed_amount_usd: 100_000,
        traceable_to_pl_usd: 0,
        destination: 1,
      }),
    ];
    const m = buildFlow(nearly, 10);
    expect(m.companiesFolded).toBe(0);
    expect(find(m.nodes, 'co:tiny')).toBeDefined();
  });

  it('lets a click on the lump reach the companies inside it', () => {
    const m = buildFlow(many, 3);
    const lump = find(m.nodes, 'co:__other__')!;
    expect(lump.aggregate).toBe(true);
    expect(lump.slugs?.length).toBe(17);
    expect(selectionForNode(lump)).toEqual({ companies: lump.slugs });
  });
});

describe('namedCompanies', () => {
  const rank = (totals: number[]) =>
    totals.map((total, i) => [`c${i}`, { name: `C${i}`, total }] as [string, { name: string; total: number }]);

  it('stops once the named companies hold most of the money', () => {
    const named = namedCompanies(rank([900, 50, 20, 15, 10, 5]), 10);
    expect(named.has('c0')).toBe(true);
    expect(named.size).toBeLessThan(6);
  });

  it('drops a lane too thin to label, even below the share target', () => {
    // c1 is a tenth of a percent: a hairline carrying a two-line label.
    const named = namedCompanies(rank([1000, 1, 1, 1, 1]), 10);
    expect(named.has('c0')).toBe(true);
    expect(named.has('c1')).toBe(false);
  });

  it('respects the count ceiling', () => {
    expect(namedCompanies(rank(Array(30).fill(100)), 4).size).toBe(4);
  });

  it('names everyone when there is no money at all to rank by', () => {
    expect(namedCompanies(rank([0, 0, 0]), 10).size).toBe(3);
  });

  it('names everyone when there is nothing to fold', () => {
    expect(namedCompanies(rank([100]), 10).size).toBe(1);
  });
});

describe('columnOrder — companies rank by size', () => {
  const co = (id: string, value: number, aggregate = false): FlowNode =>
    ({ id, column: 'company', label: id, value, aggregate });

  it('puts the largest claimant at the top', () => {
    const sorted = [co('a', 100), co('b', 900), co('c', 400)]
      .sort((x, y) => columnOrder(x) - columnOrder(y))
      .map((n) => n.id);
    expect(sorted).toEqual(['b', 'c', 'a']);
  });

  it('puts the folded lump last, however large it is', () => {
    // It used to sort into insertion order, which placed the aggregate
    // above every named company.
    const sorted = [co('other', 9_999, true), co('a', 100), co('b', 900)]
      .sort((x, y) => columnOrder(x) - columnOrder(y))
      .map((n) => n.id);
    expect(sorted).toEqual(['b', 'a', 'other']);
  });

  it('ranks measurement bases by size too', () => {
    const basis = (id: string, value: number): FlowNode =>
      ({ id, column: 'basis', label: id, value });
    const sorted = [basis('a', 10), basis('b', 90)]
      .sort((x, y) => columnOrder(x) - columnOrder(y))
      .map((n) => n.id);
    expect(sorted).toEqual(['b', 'a']);
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
