import { describe, expect, it } from 'vitest';
import { row } from './fixtures';
import { totals } from '../src/lib/filters';

/**
 * The headline sentence must never be assembled out of zeroes.
 *
 * "$0 of AI savings has been claimed across 0 disclosures. The
 * remaining $0 is not an accusation. Several of these claims are
 * audited and true." — describing a set of claims that is not there is
 * exactly the failure this project exists to document, and it appeared
 * on the front door the moment a filter matched nothing.
 *
 * `HeadlineFigure` branches on `dollarClaims === 0`. These lock the
 * condition it branches on.
 */
describe('the headline figure has something to say', () => {
  it('counts no dollar claims when nothing matches', () => {
    expect(totals([]).dollarClaims).toBe(0);
    expect(totals([]).claims).toBe(0);
  });

  it('counts no dollar claims when rows match but carry no amount', () => {
    const t = totals([
      row({ claim_kind: 'gain_claim', claimed_amount_usd: null }),
      row({ claim_kind: 'gain_claim', claimed_amount_usd: 0 }),
    ]);
    expect(t.claims).toBe(2);
    expect(t.dollarClaims).toBe(0);
  });

  it('does not count a non-gain row carrying an amount', () => {
    // A $2T market-cap loss is a real figure and not a claimed saving.
    const t = totals([
      row({ claim_kind: 'counter_evidence', claimed_amount_usd: 2_000_000_000_000 }),
    ]);
    expect(t.dollarClaims).toBe(0);
    expect(t.claimedUsd).toBe(0);
  });

  it('has something to state as soon as one gain claim carries a figure', () => {
    const t = totals([row({ claim_kind: 'gain_claim', claimed_amount_usd: 5, traceable_to_pl_usd: 2 })]);
    expect(t.dollarClaims).toBe(1);
    expect(t.claimedUsd).toBe(5);
    expect(t.unreconciledUsd).toBe(3);
  });
});
