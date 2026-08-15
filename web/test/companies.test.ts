import { describe, expect, it } from 'vitest';
import { buildProfiles, emptyProfileNote, findProfile, unanimous, verdict } from '../src/lib/companies';
import { usd } from '../src/lib/format';
import { CORPUS, row } from './fixtures';

const profiles = buildProfiles(CORPUS);
const find = (slug: string) => findProfile(profiles, slug)!;

describe('buildProfiles', () => {
  it('is one profile per company, not per claim', () => {
    const rows = [row({ ref: 'a' }), row({ ref: 'b' }), row({ ref: 'c', company_slug: 'other' })];
    expect(buildProfiles(rows)).toHaveLength(2);
  });

  it('sums money only from gain claims', () => {
    const p = buildProfiles([
      row({ ref: 'a', claimed_amount_usd: 100 }),
      row({ ref: 'b', claim_kind: 'counter_evidence', claimed_amount_usd: 999 }),
    ])[0];
    expect(p.totals.claimedUsd).toBe(100);
  });

  it('orders by claimed dollars, largest first', () => {
    expect(profiles[0].slug).toBe('ibm');
  });

  it('keeps rows newest first inside a profile', () => {
    const p = buildProfiles([
      row({ ref: 'old', claim_date: '2024-01-01' }),
      row({ ref: 'new', claim_date: '2025-01-01' }),
    ])[0];
    expect(p.rows.map((r) => r.ref)).toEqual(['new', 'old']);
  });

  it('records the first and last claim dates', () => {
    const p = buildProfiles([
      row({ ref: 'a', claim_date: '2024-01-01' }),
      row({ ref: 'b', claim_date: '2025-06-30' }),
    ])[0];
    expect(p.firstClaim).toBe('2024-01-01');
    expect(p.lastClaim).toBe('2025-06-30');
  });

  it('picks the dominant destination by row count, then by dollars', () => {
    const p = buildProfiles([
      row({ ref: 'a', destination: 1, claimed_amount_usd: 10 }),
      row({ ref: 'b', destination: 1, claimed_amount_usd: 10 }),
      row({ ref: 'c', destination: 5, claimed_amount_usd: 1000 }),
    ])[0];
    expect(p.dominantDestination).toBe(1);
  });

  it('does not invent a profile for a counterparty that has no rows of its own', () => {
    // Concentrix is named as a counterparty but files no claim here.
    expect(findProfile(profiles, 'concentrix')).toBeNull();
    expect(find('buyer').counterparties[0].name).toBe('Concentrix');
  });

  it('links an absorbed-from edge when both companies are in the ledger', () => {
    const rows = [
      row({
        ref: 'a', company_slug: 'buyer', company_name: 'Buyer',
        counterparty_absorbed: true, counterparty_slug: 'supplier', counterparty_name: 'Supplier',
        transfer_amount_usd: 50,
      }),
      row({ ref: 'b', company_slug: 'supplier', company_name: 'Supplier' }),
    ];
    const built = buildProfiles(rows);
    const supplier = findProfile(built, 'supplier')!;
    expect(supplier.absorbedFrom).toEqual([{ slug: 'buyer', name: 'Buyer', rows: 1, amountUsd: 50 }]);
  });

  it('returns null for a slug that is not in the ledger', () => {
    expect(findProfile(profiles, 'nobody')).toBeNull();
    expect(emptyProfileNote('nobody')).toContain('nobody');
  });
});

describe('unanimous', () => {
  it('agrees only when every coded value agrees', () => {
    expect(unanimous([true, true])).toBe(true);
    expect(unanimous([false, false])).toBe(false);
  });
  it('returns null on disagreement rather than picking a side', () => {
    expect(unanimous([true, false])).toBeNull();
  });
  it('ignores uncoded values rather than treating them as false', () => {
    expect(unanimous([true, null, true])).toBe(true);
  });
  it('returns null when nothing is coded at all', () => {
    expect(unanimous([null, null])).toBeNull();
  });
});

describe('the generated verdict', () => {
  it('names the money and how much of it reaches a filing', () => {
    const v = verdict(find('wtw'), usd);
    expect(v).toContain('Willis Towers Watson claims $400M');
    expect(v).toContain('$350M');
    expect(v).toContain('$50M does not');
  });

  it('says plainly when none of it reaches a filing', () => {
    expect(verdict(find('ibm'), usd)).toContain('None of it can be matched');
  });

  it('says plainly when all of it does', () => {
    expect(verdict(find('klarna'), usd)).toContain('All of it can be matched');
  });

  it('names where the gains landed instead', () => {
    expect(verdict(find('ibm'), usd)).toContain('absorbed as slack');
  });

  it('names the condition that fails', () => {
    expect(verdict(find('ibm'), usd)).toContain('billing unit survives');
  });

  it('says when a company makes no gain claim at all, without inventing one', () => {
    const v = verdict(find('atlassian'), usd);
    expect(v).toContain('makes no gain claim');
    expect(v).toContain('counter-evidence');
    expect(v).not.toContain('$0');
  });

  it('handles a gain claim with no dollar figure without producing "$0"', () => {
    const v = verdict(find('chegg'), usd);
    expect(v).toContain('none of which names a figure in dollars');
    expect(v).toContain('$23.1M is traceable');
    expect(v).not.toMatch(/claims \$0/);
  });

  it('says all three conditions are met when they are', () => {
    expect(verdict(find('wtw'), usd)).toContain('All three conditions');
  });

  it('says a condition is uncoded rather than treating it as failed', () => {
    const p = buildProfiles([row({ cond_demand_sink: null })])[0];
    expect(verdict(p, usd)).toContain('not coded');
  });

  it('regenerates when the rows change, rather than repeating a stored sentence', () => {
    const before = verdict(buildProfiles([row({ claimed_amount_usd: 100 })])[0], usd);
    const after = verdict(buildProfiles([row({ claimed_amount_usd: 900 })])[0], usd);
    expect(before).not.toBe(after);
  });

  it('is a sequence of complete sentences', () => {
    for (const p of profiles) {
      const v = verdict(p, usd);
      expect(v.length).toBeGreaterThan(20);
      expect(v.trim().endsWith('.')).toBe(true);
      expect(v).not.toContain('undefined');
      expect(v).not.toContain('NaN');
    }
  });
});
