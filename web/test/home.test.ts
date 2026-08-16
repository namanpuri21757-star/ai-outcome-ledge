import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRIME_REF, primeClaim, primeMissing } from '../src/lib/home';
import { LANDING_COPY } from '../src/lib/labels';
import { row } from './fixtures';

/* ===================================================================
   The landing page.

   It is the one surface a stranger sees first, so the risk it carries
   is different from every other view's: not that a figure is computed
   wrongly, but that a figure gets typed. A landing page is exactly the
   place where somebody rounds $3.5B to "billions saved" to make a
   sentence read better, and the whole project is the claim that the
   number can be checked.
   =================================================================== */

const SRC = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
/** Comments explain the code. A rule about what renders must not fire
 *  on the sentence explaining why the rule exists. */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const view = read('views', 'HomeView.tsx');
const rendered = stripComments(view);

describe('the example row', () => {
  it('is found by reference, not by position', () => {
    const rows = [row({ ref: 'other' }), row({ ref: PRIME_REF, company_name: 'IBM' })];
    expect(primeClaim(rows)?.company_name).toBe('IBM');
  });

  it('is null when the corpus does not carry it, rather than the first row', () => {
    expect(primeClaim([row({ ref: 'other' })])).toBeNull();
    expect(primeClaim([])).toBeNull();
  });

  it('states why it is missing, and against what', () => {
    expect(primeMissing([row(), row()])).toContain(PRIME_REF);
    expect(primeMissing([row(), row()])).toContain('2');
    expect(primeMissing([])).toContain('No rows have loaded');
  });
});

describe('nothing about the data is typed on the landing page', () => {
  it('states no dollar figure of its own', () => {
    expect(rendered).not.toMatch(/\$\s?\d/);
  });

  it('names no company, so the example cannot outlive the row', () => {
    for (const name of ['IBM', 'Klarna', 'Teleperformance', 'International Business Machines']) {
      expect(rendered, `HomeView names ${name}`).not.toContain(name);
    }
  });

  it('reads every figure it shows off the row it looked up', () => {
    for (const field of ['claimed_amount_usd', 'traceable_to_pl_usd', 'destination', 'headline']) {
      expect(view, `HomeView never reads ${field}`).toContain(field);
    }
  });

  it('carries the standing clarification with the untraced figure', () => {
    // "Not traceable" never appears without it, here least of all.
    expect(view).toContain('untracedMeaning');
  });
});

describe('the headline is locked', () => {
  it('is the question a visitor arrived with, word for word', () => {
    expect(LANDING_COPY.headline).toBe(
      'Everyone is spending billions on AI and claiming it is improving their business. But is it really?',
    );
  });

  it('is the page h1, because the landing page renders without the masthead', () => {
    expect(view).toMatch(/tag="h1"/);
    expect(view).toContain('LANDING_COPY.headline');
  });
});

describe('the animation is the same picture twice', () => {
  it('seeds the field rather than randomising it', () => {
    const waves = stripComments(read('vendor', 'reactbits', 'Waves.tsx'));
    expect(waves).not.toContain('Math.random');
    expect(view).toMatch(/seed=\{WAVE_SEED\}/);
  });

  it('hands reduced motion the finished state rather than a faster one', () => {
    const blur = read('vendor', 'reactbits', 'BlurText.tsx');
    // The global stylesheet can only reach CSS animations; both of these
    // are driven from JavaScript and have to be switched off in words.
    expect(blur).toMatch(/if \(still\)/);
    expect(view).toContain('useReducedMotion');
    expect(view).toMatch(/still=\{reduced\}/);
    expect(view).toMatch(/paused=\{reduced\}/);
  });
});
