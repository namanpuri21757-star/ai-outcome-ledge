import { describe, expect, it } from 'vitest';
import { dedupe, occurrenceText, partitionWarnings } from '../src/components/HealthStrip';

describe('dedupe', () => {
  it('collapses the same warning repeated once per run', () => {
    // This is the real case: nine warnings turned out to be three messages
    // repeated across three runs, which read as three times the problem.
    const nine = [1, 2, 3].flatMap(() => [
      { scope: 'cba', message: 'Ticker CBA is not in the SEC mapping file.' },
      { scope: 'teleperformance', message: 'Ticker TEP is not in the SEC mapping file.' },
      { scope: 'klarna', message: 'No usable us-gaap concepts found in companyfacts.' },
    ]);
    const out = dedupe(nine);
    expect(out).toHaveLength(3);
    expect(out.every((w) => w.count === 3)).toBe(true);
  });

  it('keeps distinct messages from the same scope apart', () => {
    const out = dedupe([
      { scope: 'ibm', message: 'a' },
      { scope: 'ibm', message: 'b' },
    ]);
    expect(out).toHaveLength(2);
  });

  it('returns nothing for no warnings', () => {
    expect(dedupe([])).toEqual([]);
  });

  it('carries the expected flag through, and settles it once any run sets it', () => {
    const out = dedupe([
      { scope: 'klarna', message: 'no us-gaap concepts' },
      { scope: 'klarna', message: 'no us-gaap concepts', expected: true },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].expected).toBe(true);
    expect(out[0].count).toBe(2);
  });

  it('leaves an ordinary warning unexpected', () => {
    expect(dedupe([{ scope: 'stooq', message: 'wall' }])[0].expected).toBe(false);
  });
});

describe('partitionWarnings', () => {
  const warnings = dedupe([
    { scope: 'cba', message: 'does not file with the SEC', expected: true },
    { scope: 'klarna', message: 'does not file with the SEC', expected: true },
    { scope: 'teleperformance', message: 'does not file with the SEC', expected: true },
    { scope: 'stooq', message: 'browser-verification page instead of data' },
  ]);

  it('keeps the three non-SEC filers out of the problem list', () => {
    const { problems, standing } = partitionWarnings(warnings);
    expect(problems.map((w) => w.scope)).toEqual(['stooq']);
    expect(standing.map((w) => w.scope).sort()).toEqual(['cba', 'klarna', 'teleperformance']);
  });

  it('reports no problems when only standing facts are present', () => {
    const { problems, standing } = partitionWarnings(
      dedupe([{ scope: 'cba', message: 'no filing', expected: true }]),
    );
    expect(problems).toEqual([]);
    expect(standing).toHaveLength(1);
  });

  it('handles an empty list', () => {
    expect(partitionWarnings([])).toEqual({ problems: [], standing: [] });
  });
});

describe('occurrenceText', () => {
  it('says a repeated warning is one condition seen across runs', () => {
    // The bug this replaces: "×4" read as four separate failures.
    expect(occurrenceText(4, 12)).toBe('in 4 of the last 12 runs');
  });

  it('stays silent for a single occurrence', () => {
    expect(occurrenceText(1, 12)).toBeNull();
    expect(occurrenceText(0, 12)).toBeNull();
  });
});
