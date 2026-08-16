import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blueprint, directoryBarMax, directoryCards } from '../src/lib/cover';
import { totals } from '../src/lib/aggregate';
import { define } from '../src/lib/labels';
import { row } from './fixtures';

/* ===================================================================
   The two cover pages that argue rather than list.

   Both are exposed to the same failure: a number or a definition typed
   into the argument to make it read better. The blueprint's figures have
   to be `totals()`' figures, its terms have to be the app's terms, and
   the directory has to contain companies and nothing else.
   =================================================================== */

const SRC = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const CORPUS = [
  row({ ref: 'a', company_slug: 'alpha', company_name: 'Alpha', claimed_amount_usd: 3_000_000_000, traceable_to_pl_usd: 0, destination: 1, measurement_basis: 'gross_capacity' }),
  row({ ref: 'b', company_slug: 'alpha', company_name: 'Alpha', claimed_amount_usd: 500_000_000, traceable_to_pl_usd: 100_000_000, destination: 5, measurement_basis: 'net_pl' }),
  row({ ref: 'c', company_slug: 'beta', company_name: 'Beta', claimed_amount_usd: 900_000_000, traceable_to_pl_usd: 0, destination: 2, measurement_basis: 'time' }),
  row({ ref: 'd', company_slug: 'gamma', company_name: 'Gamma', claim_kind: 'research_finding', claimed_amount_usd: null, claimed_value: 14, claimed_unit: 'pct', destination: 0 }),
];

describe('the blueprint states the corpus, not a version of it', () => {
  const stages = blueprint(CORPUS);
  const t = totals(CORPUS);

  it('draws the whole path, once each', () => {
    expect(stages).toHaveLength(4);
    expect(new Set(stages.map((s) => s.mark)).size).toBe(4);
    expect(new Set(stages.map((s) => s.key)).size).toBe(4);
  });

  it('opens on the claimed total that totals() computed', () => {
    expect(stages[0].value).toEqual({ usd: t.claimedUsd });
  });

  it('closes on the traceable share that the ledger headline uses', () => {
    expect(stages[3].value).toEqual({ pct: t.tracedSharePct });
  });

  it('counts the soft-measured claims against the dollar claims, not the rows', () => {
    // Two of the three dollar claims are measured as something other
    // than a line item that moved.
    expect(stages[1].value).toEqual({ count: 2 });
    expect(stages[1].caption).toContain('3 claims');
  });

  it('names the destination holding the most claimed money, from the buckets', () => {
    expect(stages[2].value).toEqual({ usd: 3_000_000_000 });
    expect(stages[2].caption).toContain('absorbed as slack');
  });

  it('defines every term it marks through the app vocabulary', () => {
    for (const s of stages) {
      expect(define(s.term.kind, s.term.code), `${s.key} has no definition`).not.toBeNull();
    }
  });

  it('survives an empty corpus without inventing a figure', () => {
    const empty = blueprint([]);
    expect(empty[3].value).toEqual({ pct: null });
    expect(empty[2].caption).toContain('no destination');
  });
});

describe('the directory is companies and nothing else', () => {
  const cards = directoryCards(CORPUS);

  it('carries one card per company in the rows, and no others', () => {
    expect(cards.map((c) => c.profile.slug).sort()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('leads with the largest claim, so the grid reads top down', () => {
    expect(cards.map((c) => c.profile.slug)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('picks each card a lead claim from that company, largest first', () => {
    expect(cards[0].lead?.ref).toBe('a');
    expect(cards[1].lead?.ref).toBe('c');
  });

  it('keeps a company with no dollar figure rather than dropping it', () => {
    const gamma = cards.find((c) => c.profile.slug === 'gamma')!;
    expect(gamma.profile.totals.claimedUsd).toBe(0);
    expect(gamma.lead?.ref).toBe('d');
  });

  it('adds nothing to an empty corpus', () => {
    expect(directoryCards([])).toEqual([]);
  });

  it('scales its bars to the largest company, not the largest single claim', () => {
    // Alpha claims 3.5B across two rows; no single row claims that much,
    // and a bar drawn on the row scale would run past its own card.
    expect(directoryBarMax(cards)).toBe(3_500_000_000);
    expect(directoryBarMax([])).toBe(1);
  });
});

describe('nothing about the data is typed onto either page', () => {
  const thesis = stripComments(read('views', 'ThesisView.tsx'));
  const directory = stripComments(read('views', 'DirectoryView.tsx'));

  it('states no dollar figure of its own', () => {
    expect(thesis).not.toMatch(/\$\s?\d/);
    expect(directory).not.toMatch(/\$\s?\d/);
  });

  it('names no company on the directory, so a card cannot outlive its rows', () => {
    for (const name of ['IBM', 'Klarna', 'Microsoft', 'JPMorgan', 'Accenture']) {
      expect(directory, `DirectoryView names ${name}`).not.toContain(name);
    }
  });

  it('writes no second definition of a term the app already defines', () => {
    // Both pages reach vocabulary the same way the ledger does.
    expect(thesis).toContain('<Term');
    expect(thesis).toContain('untracedMeaning');
    expect(directory).toContain('destination(');
  });

  it('hands reduced motion the finished state on both pages', () => {
    expect(thesis).toContain('useReducedMotion');
    expect(thesis).toMatch(/still=\{reduced\}/);
    expect(directory).toContain('useReducedMotion');
    expect(directory).toMatch(/reduced \? false :/);
  });

  it('staggers the grid by index rather than by anything that could vary', () => {
    expect(directory).toMatch(/i \* STEP/);
    expect(directory).not.toContain('Math.random');
  });
});
