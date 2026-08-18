import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  AXIS, AXIS_TICKS, COST_LINE, NICHES, RAMP, STATUS_TONE, TIERS, TIER_ORDER,
  bands, emptied, logPos, parseRange, readSweep, survives, tierMark, weakest,
} from '../src/lib/style';

const SRC = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const css = readFileSync(`${SRC}/styles.css`, 'utf8');
const view = readFileSync(`${SRC}/views/StyleView.tsx`, 'utf8');

/* ===================================================================
   The proof page has one job: never to look better supported than it
   is. These are the checks that would catch it drifting.
   =================================================================== */

describe('the tier vocabulary', () => {
  it('runs best to worst, so a floor can be compared by index', () => {
    expect(TIER_ORDER).toEqual(['observed', 'reported', 'estimated', 'asserted']);
  });

  it('gives every tier a mark and a stated meaning', () => {
    expect(TIERS).toHaveLength(TIER_ORDER.length);
    for (const t of TIERS) {
      expect(t.mark.length, `${t.tier} has no mark`).toBeGreaterThan(0);
      expect(t.meaning.length, `${t.tier} has no meaning`).toBeGreaterThan(30);
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  it('uses a distinct mark per tier, since a repeated mark is not a mark', () => {
    const marks = TIERS.map((t) => t.mark);
    expect(new Set(marks).size).toBe(marks.length);
  });

  it('resolves every tier to its mark', () => {
    for (const t of TIER_ORDER) expect(tierMark(t).tier).toBe(t);
  });
});

describe('the filter floor', () => {
  it('keeps a tier at or above the floor and drops the rest', () => {
    expect(survives('observed', 'observed')).toBe(true);
    expect(survives('reported', 'observed')).toBe(false);
    expect(survives('asserted', 'observed')).toBe(false);
    expect(survives('asserted', 'asserted')).toBe(true);
    expect(survives('observed', 'asserted')).toBe(true);
  });

  it('strips every figure on the page at observed only', () => {
    const cut = emptied(NICHES, 'observed');
    // Six figures: a cost and a willingness to pay for each of three rows.
    expect(cut.figuresLost).toBe(NICHES.length * 2);
    expect(cut.gutted).toBe(NICHES.length);
  });

  it('leaves exactly the two observed pieces of evidence standing', () => {
    const cut = emptied(NICHES, 'observed');
    expect(cut.evidenceKept).toBe(2);
    expect(cut.evidenceLost).toBe(3);
  });

  it('keeps everything when the floor is the weakest tier', () => {
    const cut = emptied(NICHES, 'asserted');
    expect(cut.figuresLost).toBe(0);
    expect(cut.gutted).toBe(0);
    expect(cut.evidenceLost).toBe(0);
  });
});

describe('the records', () => {
  it('carries a tier and a source on every figure', () => {
    for (const n of NICHES) {
      for (const f of [n.cost, n.wtp]) {
        expect(TIER_ORDER, `${n.ref} has an unknown tier`).toContain(f.tier);
        expect(f.source.length, `${n.ref} has an unsourced figure`).toBeGreaterThan(10);
      }
    }
  });

  it('states a formula wherever it claims to have estimated something', () => {
    for (const n of NICHES) {
      for (const f of [n.cost, n.wtp]) {
        if (f.tier === 'estimated') {
          expect(f.formula, `${n.ref} estimates without showing its working`).toBeTruthy();
        }
      }
    }
  });

  it('cross-references every piece of evidence to its row', () => {
    for (const n of NICHES) {
      for (const e of n.evidence) {
        expect(e.ref.startsWith(n.ref), `${e.ref} does not belong to ${n.ref}`).toBe(true);
      }
    }
  });

  it('classifies each row as content or languages, never both and never neither', () => {
    for (const n of NICHES) {
      expect(['content', 'languages']).toContain(n.classification);
    }
    // The distinction is only worth having if the record uses both.
    const kinds = new Set(NICHES.map((n) => n.classification));
    expect(kinds.size).toBe(2);
  });

  it('reports the weakest tier a row rests on, not an average', () => {
    expect(weakest(NICHES[0])).toBe('estimated'); // A-1: reported cost, estimated WTP
    expect(weakest(NICHES[1])).toBe('asserted');
    expect(weakest(NICHES[2])).toBe('asserted');
  });

  it('dates every status, because a status is reversible', () => {
    for (const n of NICHES) {
      expect(n.statusChanged, `${n.ref} has an undated status`).toMatch(/^\d{4}-\d{2}$/);
      expect(n.statusReason.length).toBeGreaterThan(30);
    }
  });
});

describe('the two accents, and no more', () => {
  it('gives colour only to threshold crossed and contradicted', () => {
    expect(STATUS_TONE.threshold_crossed).toBe('crossed');
    expect(STATUS_TONE.contradicted).toBe('against');
    expect(STATUS_TONE.dormant).toBe('ink');
    expect(STATUS_TONE.contested).toBe('ink');
  });

  it('paints those two from the existing palette rather than a new hue', () => {
    expect(css).toMatch(/\.sweep-band\[data-tone='crossed'\][^}]*var\(--traced\)/s);
    expect(css).toMatch(/\.sweep-band\[data-tone='against'\][^}]*var\(--gap\)/s);
    expect(css).toMatch(/\.status\[data-tone='crossed'\][^}]*var\(--traced\)/s);
  });

  it('introduces no colour literal of its own in the proof block', () => {
    const block = css.slice(css.indexOf('THE STYLE PROOF'));
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(block).not.toMatch(/rgba?\(/);
  });
});

describe('the sweep', () => {
  it('reads a range only when the source wrote one', () => {
    expect(parseRange('$50–200 per finished minute')).toEqual({ low: 50, high: 200 });
    expect(parseRange('Not established')).toBeNull();
    expect(parseRange('Falling, range not established')).toBeNull();
  });

  it('places the axis endpoints at nought and one hundred per cent', () => {
    expect(logPos(AXIS.min)).toBeCloseTo(0, 6);
    expect(logPos(AXIS.max)).toBeCloseTo(100, 6);
  });

  it('spaces decades evenly, which is what makes it a log axis', () => {
    const a = logPos(10) - logPos(1);
    const b = logPos(100) - logPos(10);
    expect(a).toBeCloseTo(b, 6);
  });

  it('ticks only at values the record actually reaches', () => {
    for (const t of AXIS_TICKS) {
      expect(t).toBeGreaterThanOrEqual(AXIS.min);
      expect(t).toBeLessThanOrEqual(AXIS.max);
    }
  });

  it('draws a band for one niche and refuses to draw one for the other two', () => {
    const b = bands(NICHES);
    const drawn = b.filter((x) => x.low !== null && x.high !== null);
    expect(drawn).toHaveLength(1);
    expect(drawn[0].ref).toBe('A-1');
    for (const absent of b.filter((x) => x.low === null)) {
      expect(absent.absence, `${absent.ref} has no stated reason for its absence`).toBeTruthy();
    }
  });

  it('reads crossed, dormant and contested off the rule the same way every time', () => {
    const band = { ref: 'x', name: 'x', status: 'dormant' as const, low: 50, high: 200, tier: 'estimated' as const };
    expect(readSweep(band, 10)).toBe('threshold_crossed');
    expect(readSweep(band, 300)).toBe('dormant');
    expect(readSweep(band, 100)).toBe('contested');
  });

  it('returns no reading at all where there is no band', () => {
    const band = { ref: 'x', name: 'x', status: 'dormant' as const, low: null, high: null, tier: 'asserted' as const };
    expect(readSweep(band, 10)).toBeNull();
  });

  it('agrees with the status the record carries for the one row it can read', () => {
    const [a] = bands(NICHES);
    expect(readSweep(a, COST_LINE.high)).toBe(NICHES[0].status);
  });
});

describe('the ramp the page shows is the ramp the stylesheet declares', () => {
  it('states the same pixel size for every rung', () => {
    for (const rung of RAMP) {
      const declared = css.match(new RegExp(`${rung.token}:\\s*(\\d+px)`));
      expect(declared, `${rung.token} is not in the stylesheet`).toBeTruthy();
      expect(declared![1], `${rung.token} drifted`).toBe(rung.size);
    }
  });

  it('never writes a rung as a literal size in the view', () => {
    expect(view).not.toMatch(/fontSize:\s*['"]\d+px/);
  });
});

describe('the page cannot quietly stop being a proof', () => {
  it('reads no data source of any kind', () => {
    expect(view).not.toContain('supabase');
    expect(view).not.toContain('loadDataset');
    expect(view).not.toContain('fetch(');
    expect(view).not.toMatch(/\bprops\.data\b/);
  });

  it('renders every figure through the tiered component rather than as a bare value', () => {
    // A figure printed straight into JSX is the failure this page exists
    // to make impossible, so the component is the only way in.
    const cells = view.match(/<td>\{[^}]*\}<\/td>/g) ?? [];
    for (const cell of cells) {
      expect(cell, `bare cell: ${cell}`).toMatch(/Figure|Struck|TierChip|StatusCell|CLASSIFICATION/);
    }
  });

  it('keeps the emptied cells rather than reflowing them away', () => {
    expect(view).toContain('Struck');
    expect(css).toMatch(/\.struck-box\s*\{[^}]*height:/s);
  });

  it('moves once, on a spring, and stands still when asked to', () => {
    expect(view).toContain('useReducedMotion');
    expect(view).toContain("type: 'spring'");
    expect(view).not.toContain('ease-in-out');
    expect(view).not.toMatch(/ease:\s*['"]linear['"]/);
  });

  it('staggers rows inside the 20 to 30 millisecond window', () => {
    const step = view.match(/ROW_STEP\s*=\s*([\d.]+)/);
    expect(step).toBeTruthy();
    const ms = Number(step![1]) * 1000;
    expect(ms).toBeGreaterThanOrEqual(20);
    expect(ms).toBeLessThanOrEqual(30);
  });

  it('sets every numeral in tabular figures', () => {
    // Each class the page uses for a number resolves to a tabular rule.
    for (const cls of ['.sched-ref', '.figure-value', '.status-since', '.evrow-ref', '.sweeprow-ref']) {
      const rule = css.match(new RegExp(`\\${cls}[^}]*\\}`, 's'));
      expect(rule, `${cls} has no rule`).toBeTruthy();
      expect(rule![0], `${cls} is not tabular`).toContain('tabular-nums');
    }
  });

  it('says plainly that nothing here came from a filed statement', () => {
    expect(view).toMatch(/filed financial statement/);
  });
});
