import { describe, expect, it } from 'vitest';
import { dedupe } from '../src/components/HealthStrip';

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
});
