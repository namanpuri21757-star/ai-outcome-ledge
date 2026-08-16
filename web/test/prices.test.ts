import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BREAK, GRAMMARLY, PANELS, REV_AI, REV_HUMAN, SOURCING_NOTE, TAKEAWAY,
  listPrice, pathD, plot, readPoint,
  type PriceSeries,
} from '../src/lib/prices';
import { COVER_VIEWS, isCover, parseHash, toHash } from '../src/lib/route';
import { EMPTY_FILTERS } from '../src/lib/filters';
import { LANDING_COPY } from '../src/lib/labels';

/* ===================================================================
   The price page is the one surface whose data is typed rather than
   collected, which makes it the one surface where a wrong number can
   get in without anything upstream noticing. So the checks here are
   mostly about what is *not* on it.

   Three failures these are built to catch:

     1. A price, date or source that nobody supplied — an interpolated
        point, a rounded axis label, a filled-in gap.
     2. A line drawn through the October 2025 repackaging, which would
        show Grammarly cutting its price when it did not.
     3. The written finding drifting away from the table underneath it.
        The sentence claims two percentages; both are recomputed here
        from the prices, so the sentence cannot quietly go stale.
   =================================================================== */

const SRC = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');

const ALL: PriceSeries[] = [REV_HUMAN, REV_AI, GRAMMARLY];

/** The table as supplied, restated independently of the module. */
const SUPPLIED = [
  ['rev-human', '2016-05-11', 1.0],
  ['rev-human', '2017-12-07', 1.0],
  ['rev-human', '2020-03-11', 1.25],
  ['rev-human', '2023-07-20', 1.5],
  ['rev-human', '2026-08-16', 1.99],
  ['rev-ai', '2019-06-13', 0.1],
  ['rev-ai', '2026-08-16', 0.25],
  ['grammarly', '2021-07-06', 12.5],
  ['grammarly', '2023-06-03', 15.0],
  ['grammarly', '2025-05-08', 15.0],
  ['grammarly', '2026-07-15', 12.0],
  ['grammarly', '2026-07-15', 33.0],
] as const;

describe('the table is the table', () => {
  it('holds exactly the points that were supplied, and no others', () => {
    const got = ALL.flatMap((s) => s.points.map((p) => [s.key, p.date, p.usd]));
    expect(got).toEqual(SUPPLIED.map((r) => [...r]));
  });

  it('gives every point a source, because a point without one cannot be shown', () => {
    for (const s of ALL) {
      for (const p of s.points) {
        expect(p.source, `${s.key} ${p.date}`).toMatch(/^https:\/\/\S+$/);
      }
    }
    expect(BREAK.source).toMatch(/^https:\/\/\S+$/);
  });

  it('describes nothing as archived, anywhere in the data or the page', () => {
    const bodies = [
      read('lib', 'prices.ts'),
      read('views', 'PricesView.tsx'),
      read('components', 'PriceChart.tsx'),
    ];
    for (const body of bodies) {
      expect(body).not.toMatch(/wayback/i);
      // "archive" is allowed only where the page says these are *not*
      // archive captures, which is the sourcing note itself.
      const stray = body
        .replace(SOURCING_NOTE, '')
        .replace(/not from an archive capture[^.]*\./g, '');
      expect(stray).not.toMatch(/\barchived\b/i);
    }
  });
});

describe('the written finding still matches the prices under it', () => {
  it('states the two rises the table actually shows', () => {
    const rise = (s: PriceSeries) => {
      const first = s.points[0].usd;
      const last = s.points[s.points.length - 1].usd;
      return Math.round(((last - first) / first) * 100);
    };
    expect(rise(REV_HUMAN)).toBe(99);
    expect(rise(REV_AI)).toBe(150);
    expect(TAKEAWAY).toContain('rose 99%');
    expect(TAKEAWAY).toContain('rose 150%');
  });

  it('never calls the Grammarly move a price cut', () => {
    expect(TAKEAWAY).toContain('plan repackaging');
    expect(TAKEAWAY).not.toMatch(/price cut/i);
  });
});

describe('the structural break is drawn, not smoothed', () => {
  it('never joins the last pre-break price to a 2026 tier', () => {
    // Index 2 is 2025-05-08 and index 3 is the 2026 Pro price. A run
    // containing both would be the line that shows a cut.
    for (const run of GRAMMARLY.runs) {
      expect(run.includes(2) && run.includes(3)).toBe(false);
      expect(run.includes(3) && run.includes(4)).toBe(false);
    }
  });

  it('leaves the two 2026 tiers standing alone, as points rather than a line', () => {
    const p = plot([GRAMMARLY], true);
    const [g] = p.series;
    expect(g.paths).toHaveLength(1);
    expect(g.paths[0].map((pt) => pt.date)).toEqual([
      '2021-07-06', '2023-06-03', '2025-05-08',
    ]);
    expect(g.points).toHaveLength(5);
  });

  it('puts the rule on the chart, labelled and linked', () => {
    const p = plot([GRAMMARLY], true);
    expect(p.break).not.toBeNull();
    expect(p.break!.label).toBe('Oct 2025 — Business plan folded into Pro');
    expect(p.break!.source).toBe(BREAK.source);
    expect(p.break!.x).toBeGreaterThan(p.pad.l);
    expect(p.break!.x).toBeLessThan(p.width - p.pad.r);
  });

  it('draws no rule on the panel that has no break', () => {
    expect(plot([REV_HUMAN, REV_AI]).break).toBeNull();
  });
});

describe('the chart prints nothing that was not published', () => {
  const panels = PANELS.map((panel) => plot(panel.series, panel.key === 'grammarly'));

  it('ticks the y axis only at published prices', () => {
    for (const [i, p] of panels.entries()) {
      const published = new Set(PANELS[i].series.flatMap((s) => s.points.map((pt) => pt.usd)));
      for (const t of p.yTicks) expect(published.has(t.usd)).toBe(true);
      for (const t of p.yLabels) expect(published.has(t.usd)).toBe(true);
    }
  });

  it('writes the axis at the lowest and highest published price only', () => {
    const [rev, gram] = panels;
    expect(rev.yLabels.map((t) => t.usd)).toEqual([0.1, 1.99]);
    expect(gram.yLabels.map((t) => t.usd)).toEqual([12, 33]);
  });

  it('ticks the x axis only at published dates', () => {
    for (const [i, p] of panels.entries()) {
      const dates = new Set(PANELS[i].series.flatMap((s) => s.points.map((pt) => pt.date)));
      for (const t of p.xTicks) expect(dates.has(t.date)).toBe(true);
    }
  });

  it('types no dollar figure into either the chart or the page', () => {
    for (const body of [read('components', 'PriceChart.tsx'), read('views', 'PricesView.tsx')]) {
      const live = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(live).not.toMatch(/\$\d/);
    }
  });

  it('writes a price with its cents, because $1.99 is not $2', () => {
    expect(listPrice(1.99)).toBe('$1.99');
    expect(listPrice(1)).toBe('$1.00');
    expect(listPrice(12.5)).toBe('$12.50');
  });
});

describe('the drawing is the same drawing on every load', () => {
  it('lays out identically when laid out twice', () => {
    for (const panel of PANELS) {
      const a = plot(panel.series, panel.key === 'grammarly');
      const b = plot(panel.series, panel.key === 'grammarly');
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('builds a path from the points and nothing else', () => {
    const p = plot([REV_AI]);
    expect(pathD(p.series[0].points)).toMatch(/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/);
  });

  it('reads a point out in words, tier included', () => {
    const p = plot([GRAMMARLY], true);
    const [g] = p.series;
    expect(readPoint(g, g.points[4])).toContain('$33.00');
    expect(readPoint(g, g.points[4])).toContain('new Business tier, Superhuman suite');
    expect(readPoint(g, g.points[0])).not.toContain('(');
  });
});

describe('the page is reachable, and it is a cover', () => {
  it('is one of the dark surfaces that render outside the shell', () => {
    expect(COVER_VIEWS).toContain('prices');
    expect(isCover('prices')).toBe(true);
  });

  it('is reached and left by the hash, like every other view', () => {
    expect(parseHash('#/prices').view).toBe('prices');
    expect(toHash({ view: 'prices', id: null, filters: EMPTY_FILTERS })).toBe('#/prices');
  });

  it('carries no filter, even when the URL is edited by hand', () => {
    expect(parseHash('#/prices?dest=5&q=ibm').filters).toEqual(EMPTY_FILTERS);
    expect(
      toHash({ view: 'prices', id: null, filters: { ...EMPTY_FILTERS, destinations: [5] } }),
    ).toBe('#/prices');
  });

  it('offers the landing page a second way in, worded as supplied', () => {
    expect(LANDING_COPY.prices).toBe("AI got cheaper, why isn't everyone out pricing");
    // The first way in is untouched.
    expect(LANDING_COPY.enter).toBe('Let me show you what I mean.');
  });

  it('reads no corpus and no network', () => {
    const body = read('views', 'PricesView.tsx') + read('components', 'PriceChart.tsx')
      + read('lib', 'prices.ts');
    for (const forbidden of ['supabase', 'v_ledger', 'observations', 'fetch(', 'Dataset']) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });
});
