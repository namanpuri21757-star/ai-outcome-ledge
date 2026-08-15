import { describe, expect, it } from 'vitest';
import { probeStooq, stooqUrl } from '../src/stooq';

/**
 * Does the price source still serve data?
 *
 * This is the check that was missing. The pipeline learned that Stooq had
 * started refusing automated clients eighteen hours later, from a warning
 * banner in the interface that blamed the ticker symbols. One deliberate
 * request answers the question in two seconds.
 *
 * Run with `npm run smoke`. A failure here is a statement about the
 * source, not about this repository.
 */
describe('Stooq, live', () => {
  it('serves parseable CSV for a known-good symbol', async () => {
    const result = await probeStooq('ibm.us');

    if (!result.ok) {
      throw new Error(
        `Stooq did not return usable CSV (${result.kind}).\n` +
          `  ${result.message}\n` +
          `  URL: ${stooqUrl('ibm.us')}\n` +
          (result.kind === 'challenge'
            ? '  This is the browser-verification wall, not a bad symbol. Prices cannot be\n' +
              '  collected from Stooq while it stands; margins come from the SEC and are\n' +
              '  unaffected. Switching the price source is a decision, not a patch.'
            : '  Check the endpoint by hand before changing the parser.'),
      );
    }

    expect(result.rows).toBeGreaterThan(100);
    // A stale-but-parseable feed is its own failure mode: the CSV is
    // valid and the last row is from last year.
    const ageDays = (Date.now() - Date.parse(result.latest + 'T00:00:00Z')) / 86_400_000;
    expect(ageDays).toBeLessThan(10);
  });
});
