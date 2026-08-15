import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  barMax, byDestination, byKind, destinationBarMax, headline, inDenominator, listOf, plural,
  totals, totalsBy,
} from '../src/lib/aggregate';
import { applyFilters, EMPTY_FILTERS, type Filters } from '../src/lib/filters';
import { buildProfiles } from '../src/lib/companies';
import { usd } from '../src/lib/format';
import { CORPUS, row } from './fixtures';

/* ===================================================================
   The invariant this whole rebuild turns on: one quantity, one number.

   The previous build showed "$428M traceable" in the flow headline and
   "$451M traceable" in the sidebar, on the same screen, for the same
   selection — because two functions summed the same column with two
   different rules. These tests make that shape impossible to
   reintroduce without a failure.
   =================================================================== */

describe('totals: what may enter a money figure', () => {
  it('counts only gain claims, so a $2T market cap never lands in a savings total', () => {
    const t = totals(CORPUS);
    expect(t.claimedUsd).toBe(3_500_000_000 + 400_000_000 + 28_000_000 + 100 + 130_000_000);
    expect(t.claimedUsd).toBeLessThan(2_000_000_000_000);
  });

  it('counts every row of every kind in the row count', () => {
    expect(totals(CORPUS).rows).toBe(CORPUS.length);
  });

  it('holds the denominator to gain claims that named dollars', () => {
    const t = totals(CORPUS);
    expect(t.gainClaims).toBe(6);
    expect(t.dollarClaims).toBe(5);
    expect(t.nonDollarClaims).toBe(1);
  });

  it('keeps traced dollars out of the ratio when their claim named none', () => {
    // This single row is the entire $428M-vs-$451M discrepancy.
    const t = totals(CORPUS);
    expect(t.tracedOutsideDenominatorUsd).toBe(23_100_000);
    expect(t.tracedOutsideDenominatorClaims).toBe(1);
    expect(t.tracedUsd).toBe(350_000_000 + 28_000_000 + 500);
  });

  it('reports an over-traced row instead of clamping it away', () => {
    const t = totals(CORPUS);
    expect(t.overTracedClaims).toBe(1);
    // Not clamped: the sum still carries the coded figure.
    expect(t.tracedUsd).toBeGreaterThan(350_000_000 + 28_000_000);
  });

  it('makes untraced exactly claimed minus traced, always', () => {
    const t = totals(CORPUS);
    expect(t.untracedUsd).toBe(t.claimedUsd - t.tracedUsd);
  });

  it('returns a null share rather than a division by zero', () => {
    expect(totals([]).tracedSharePct).toBeNull();
    expect(totals([row({ claim_kind: 'context', claimed_amount_usd: null })]).tracedSharePct).toBeNull();
  });

  it('treats a $0 claim as not stated in dollars', () => {
    const t = totals([row({ claimed_amount_usd: 0, traceable_to_pl_usd: 0 })]);
    expect(t.dollarClaims).toBe(0);
    expect(t.nonDollarClaims).toBe(1);
  });

  it('is empty and safe for an empty selection', () => {
    const t = totals([]);
    expect(t.rows).toBe(0);
    expect(t.claimedUsd).toBe(0);
    expect(t.companies).toBe(0);
  });
});

describe('cross-view consistency: the parts sum to the whole', () => {
  const FILTER_STATES: Array<[string, Filters]> = [
    ['no filter', EMPTY_FILTERS],
    ['gain claims only', { ...EMPTY_FILTERS, kinds: ['gain_claim'] }],
    ['kept as margin', { ...EMPTY_FILTERS, destinations: [5] }],
    ['dollars only', { ...EMPTY_FILTERS, dollarsOnly: true }],
    ['a search that matches some', { ...EMPTY_FILTERS, search: 'savings' }],
    ['a search that matches nothing', { ...EMPTY_FILTERS, search: 'zzzznothing' }],
  ];

  for (const [name, filters] of FILTER_STATES) {
    const rows = applyFilters(CORPUS, filters);
    const whole = totals(rows);

    it(`destination buckets sum to the whole — ${name}`, () => {
      const buckets = byDestination(rows);
      const sum = (pick: (b: (typeof buckets)[number]) => number) =>
        buckets.reduce((a, b) => a + pick(b), 0);

      expect(sum((b) => b.totals.claimedUsd)).toBe(whole.claimedUsd);
      expect(sum((b) => b.totals.tracedUsd)).toBe(whole.tracedUsd);
      expect(sum((b) => b.totals.untracedUsd)).toBe(whole.untracedUsd);
      expect(sum((b) => b.totals.gainClaims)).toBe(whole.gainClaims);
      expect(sum((b) => b.totals.rows)).toBe(whole.rows);
      expect(sum((b) => b.totals.tracedOutsideDenominatorUsd)).toBe(
        whole.tracedOutsideDenominatorUsd,
      );
    });

    it(`kind buckets sum to the whole — ${name}`, () => {
      const buckets = byKind(rows);
      expect(buckets.reduce((a, b) => a + b.totals.claimedUsd, 0)).toBe(whole.claimedUsd);
      expect(buckets.reduce((a, b) => a + b.totals.rows, 0)).toBe(whole.rows);
    });

    it(`company profiles sum to the whole — ${name}`, () => {
      const profiles = buildProfiles(rows);
      expect(profiles.reduce((a, p) => a + p.totals.claimedUsd, 0)).toBe(whole.claimedUsd);
      expect(profiles.reduce((a, p) => a + p.totals.tracedUsd, 0)).toBe(whole.tracedUsd);
      expect(profiles.reduce((a, p) => a + p.totals.rows, 0)).toBe(whole.rows);
      expect(profiles.length).toBe(whole.companies);
    });

    it(`the headline agrees with totals — ${name}`, () => {
      const h = headline(rows, usd);
      expect(h.claimedUsd).toBe(whole.claimedUsd);
      expect(h.tracedUsd).toBe(whole.tracedUsd);
      expect(h.untracedUsd).toBe(whole.untracedUsd);
      expect(h.sharePct).toBe(whole.tracedSharePct);
      expect(h.dollarClaims).toBe(whole.dollarClaims);
    });
  }

  it('always shows all six destinations, including empty ones', () => {
    const buckets = byDestination([]);
    expect(buckets).toHaveLength(6);
    expect(buckets.map((b) => b.key)).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it('keeps the destinations in ladder order regardless of size', () => {
    expect(byDestination(CORPUS).map((b) => b.key)).toEqual([1, 2, 3, 4, 5, 0]);
  });
});

describe('the headline sentence', () => {
  it('states the share and the denominator it is a share of', () => {
    const h = headline(CORPUS, usd);
    expect(h.sharePct).toBeCloseTo((378_000_500 / 4_058_000_100) * 100, 6);
    expect(h.sentence).toContain('5 gain claims');
    expect(h.sentence).toContain('named line item');
  });

  it('always reports the traced dollars that cannot enter the percentage', () => {
    expect(headline(CORPUS, usd).asideSentence).toContain('$23.1M');
    expect(headline(CORPUS, usd).asideSentence).toContain('cannot enter the percentage');
  });

  it('says nothing about the aside when there is nothing to say', () => {
    const clean = CORPUS.filter((r) => r.ref !== 'chegg-shape');
    expect(headline(clean, usd).asideSentence).toBeNull();
  });

  it('does not assemble a sentence out of zeroes when nothing is in dollars', () => {
    const h = headline([row({ claimed_amount_usd: null, claimed_unit: 'pct' })], usd);
    expect(h.sharePct).toBeNull();
    expect(h.sentence).toContain('no percentage to give');
  });

  it('says so plainly when the selection holds no gain claim at all', () => {
    const h = headline([row({ claim_kind: 'context', claimed_amount_usd: null })], usd);
    expect(h.sentence).toContain('nothing to reconcile');
  });
});

describe('the shared bar scale', () => {
  it('is the largest single dollar claim in the whole corpus', () => {
    expect(barMax(CORPUS)).toBe(3_500_000_000);
  });

  it('ignores rows that are not gain claims, so a market cap cannot set it', () => {
    expect(barMax(CORPUS)).toBeLessThan(2_000_000_000_000);
  });

  it('never returns zero, so a bar can never divide by it', () => {
    expect(barMax([])).toBe(1);
    expect(destinationBarMax([])).toBe(1);
  });
});

describe('helpers', () => {
  it('groups with the same function that totals the whole', () => {
    const buckets = totalsBy(CORPUS, (r) => r.company_slug);
    expect(buckets.reduce((a, b) => a + b.totals.claimedUsd, 0)).toBe(totals(CORPUS).claimedUsd);
  });

  it('knows which rows are in the denominator', () => {
    expect(inDenominator(row({ claimed_amount_usd: 1 }))).toBe(true);
    expect(inDenominator(row({ claimed_amount_usd: null }))).toBe(false);
    expect(inDenominator(row({ claim_kind: 'context', claimed_amount_usd: 1 }))).toBe(false);
  });

  it('pluralises and lists in English', () => {
    expect(plural(1, 'claim')).toBe('claim');
    expect(plural(2, 'claim')).toBe('claims');
    expect(listOf([])).toBe('');
    expect(listOf(['a'])).toBe('a');
    expect(listOf(['a', 'b'])).toBe('a and b');
    expect(listOf(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

/* ===================================================================
   The rule, enforced by reading the tree.
   =================================================================== */

describe('no second place adds dollars up', () => {
  const SRC = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  }

  const files = walk(SRC).filter((f) => /\.tsx?$/.test(f));

  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('leaves every claimed/traceable sum to aggregate.ts', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith(`aggregate.ts`)) continue;
      const text = readFileSync(file, 'utf8');
      // A money column named next to a fold is the shape being banned.
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!/claimed_amount_usd|traceable_to_pl_usd|unreconciled_usd/.test(line)) return;
        if (/\.reduce\(|\breduce</.test(line)) {
          offenders.push(`${file.slice(SRC.length)}:${i + 1}`);
        }
      });
      // A reduce over a money field split across lines.
      const joined = text.replace(/\s+/g, ' ');
      const m = joined.match(
        /reduce\([^)]*?(claimed_amount_usd|traceable_to_pl_usd|unreconciled_usd)/g,
      );
      if (m) offenders.push(`${file.slice(SRC.length)} (multi-line reduce)`);
    }
    expect(offenders, `these files sum money outside aggregate.ts:\n${offenders.join('\n')}`)
      .toEqual([]);
  });

  it('keeps devData out of production by two independent guards', () => {
    const text = readFileSync(join(SRC, 'lib', 'devData.ts'), 'utf8');
    expect(text).toContain('import.meta.env.DEV');
    expect(text).toContain("VITE_FIXTURES === '1'");
  });

  it('never puts the service-role key anywhere in web/', () => {
    for (const file of files) {
      expect(readFileSync(file, 'utf8')).not.toContain('SERVICE_ROLE');
    }
  });
});
