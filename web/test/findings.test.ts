import { describe, expect, it } from 'vitest';
import { FINDINGS, findingById } from '../src/lib/findings';
import { applyFilters } from '../src/lib/filters';
import { CORPUS, row } from './fixtures';

describe('findings', () => {
  it('every finding runs on an empty corpus without throwing', () => {
    for (const f of FINDINGS) {
      const r = f.run([]);
      expect(r.empty).toBeTruthy();
      expect(r.entries).toEqual([]);
    }
  });

  it('every finding states its own emptiness rather than inventing an answer', () => {
    for (const f of FINDINGS) {
      const r = f.run([]);
      expect(r.answer).toBe('');
      expect(typeof r.empty).toBe('string');
    }
  });

  it('each finding has a stable id and is retrievable by it', () => {
    for (const f of FINDINGS) expect(findingById(f.id)).toBe(f);
    expect(findingById('nope')).toBeNull();
  });

  it("each finding's filter actually selects the rows it describes", () => {
    const slack = findingById('slack')!;
    const selected = applyFilters(CORPUS, slack.filter);
    expect(selected.every((r) => r.destination === 1 && r.claim_kind === 'gain_claim')).toBe(true);
    expect(selected).toHaveLength(2);
  });
});

describe('the slack finding', () => {
  const result = findingById('slack')!.run(CORPUS);

  it('counts the claims and the companies', () => {
    expect(result.answer).toMatch(/2 gain claims/);
    expect(result.answer).toMatch(/2 companies/);
  });

  it('reports the total and says none of it reached a line item', () => {
    expect(result.answer).toMatch(/\$3\.56B/);
    expect(result.answer).toMatch(/none of it reaches a disclosed line item/);
  });

  it('gives every entry a reason drawn from its own rows', () => {
    expect(result.entries.length).toBeGreaterThan(0);
    for (const e of result.entries) expect(e.why.length).toBeGreaterThan(10);
  });

  it('uses the row rationale as the reason when one exists', () => {
    const ibm = result.entries.find((e) => e.slug === 'ibm')!;
    expect(ibm.why).toMatch(/redeployed/);
  });
});

describe('the margin finding', () => {
  const result = findingById('margin')!.run(CORPUS);

  it('splits the companies by what kind of company they are', () => {
    expect(result.answer).toMatch(/large incumbent/);
  });

  it('says how many have a measured margin rather than implying all do', () => {
    expect(result.answer).toMatch(/1 of them have a measured operating-margin movement/);
  });

  it('says the coding is untested when nothing is measured', () => {
    const unmeasured = CORPUS.map((r) => ({ ...r, margin_delta_4q_bps: null }));
    expect(findingById('margin')!.run(unmeasured).answer).toMatch(/untested against the filings/);
  });
});

describe('the transfer finding', () => {
  const result = findingById('transfer')!.run(CORPUS);

  it('distinguishes named suppliers from unestablished ones', () => {
    expect(result.answer).toMatch(/1 of them name the supplier/);
    expect(result.answer).toMatch(/0 do not/);
  });

  it('admits when no amount has been identified', () => {
    const noAmount = CORPUS.map((r) => ({ ...r, transfer_amount_usd: null }));
    expect(findingById('transfer')!.run(noAmount).answer).toMatch(/No amount has been identified/);
  });
});

describe('the conditions finding', () => {
  it('says the hypothesis is stated but not yet tested when nothing is measured', () => {
    const unmeasured = CORPUS.map((r) => ({ ...r, margin_delta_4q_bps: null }));
    const result = findingById('conditions')!.run(unmeasured);
    expect(result.answer).toMatch(/not yet tested/);
    expect(result.answer).toMatch(/becomes testable/);
  });

  it('reports the mean once a margin exists', () => {
    const result = findingById('conditions')!.run(CORPUS);
    expect(result.answer).toMatch(/Mean movement where all three are met/);
  });
});

describe('the contradiction finding', () => {
  it('finds only rows carrying a countervailing observation', () => {
    const result = findingById('contradicted')!.run(CORPUS);
    expect(result.answer).toMatch(/2 rows/);
  });

  it('quotes the countervailing observation as the reason', () => {
    const result = findingById('contradicted')!.run(CORPUS);
    const klarna = result.entries.find((e) => e.slug === 'klarna')!;
    expect(klarna.why).toMatch(/rose 19%/);
  });

  it('reports emptiness when no row has one', () => {
    const clean = CORPUS.map((r) => ({ ...r, observed_counter_move: null }));
    expect(findingById('contradicted')!.run(clean).empty).toBeTruthy();
  });
});

describe('the uncheckable finding', () => {
  it('catches both undefined bases and disputed rows', () => {
    const result = findingById('undefined')!.run(CORPUS);
    expect(result.answer).toMatch(/1 row/);
    expect(result.entries[0].why).toMatch(/company-confirmed headcount/);
  });

  it('reports emptiness when every row has a defined basis', () => {
    const clean = CORPUS.map((r) => ({
      ...r, measurement_basis: 'net_pl' as const, verification_status: 'verified_primary' as const,
    }));
    expect(findingById('undefined')!.run(clean).empty).toBeTruthy();
  });
});

describe('generated prose', () => {
  it('changes when the underlying rows change, so it cannot go stale', () => {
    const before = findingById('slack')!.run(CORPUS).answer;
    const after = findingById('slack')!.run([
      ...CORPUS,
      row({ ref: 'extra', company_slug: 'new-co', company_name: 'New Co', destination: 1,
        claimed_amount_usd: 1_000_000_000 }),
    ]).answer;
    expect(after).not.toBe(before);
    expect(after).toMatch(/3 gain claims/);
  });
});
