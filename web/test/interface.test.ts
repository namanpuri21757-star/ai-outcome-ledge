import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* ===================================================================
   Rules about the interface that no unit test can reach, checked by
   reading the source: the voice, the type floor, the absence of the
   things the brief named as defects, and the absence of every view
   this rebuild deleted.

   These are cheap and they are the ones that rot first.
   =================================================================== */

const SRC = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(SRC);
const code = files.filter((f) => /\.tsx?$/.test(f));
const text = (f: string) => readFileSync(f, 'utf8');
/** Comments describe the code; they are not the code. A rule about what
 *  the interface renders must not fire on a sentence explaining it. */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const all = code.map((f) => ({
  file: f.slice(SRC.length).replace(/\\/g, '/'),
  body: text(f),
  live: stripComments(text(f)),
}));
const css = text(join(SRC, 'styles.css'));

describe('the deleted views are deleted, not hidden', () => {
  const GONE = [
    'FlowView', 'PatternsView', 'CompaniesView', 'DestinationsView', 'ConditionsView',
    'TransfersView', 'QueueView', 'SubmitView', 'FindingsView', 'ReconciliationView',
    'Sankey', 'FlowLadder', 'CompareTray', 'ClaimDetail', 'MarginChart', 'TimeSeriesChart',
    'Sparkline', 'HealthStrip', 'FilterBar', 'ActiveFilters', 'DestinationLadder',
    'ConditionFlags',
  ];

  it('leaves no file behind for any of them', () => {
    const names = files.map((f) => f.split(/[\\/]/).pop()!.replace(/\.tsx?$/, ''));
    for (const gone of GONE) expect(names, gone).not.toContain(gone);
  });

  it('leaves no import of any of them', () => {
    for (const { file, body } of all) {
      for (const gone of GONE) {
        expect(body, `${file} still imports ${gone}`).not.toMatch(
          new RegExp(`from\\s+['"][^'"]*${gone}['"]`),
        );
      }
    }
  });

  it('leaves no route that could still reach one', () => {
    const route = text(join(SRC, 'lib', 'route.ts'));
    for (const dead of ['flow', 'patterns', 'companies', 'destinations', 'conditions',
                        'transfers', 'queue', 'submit', 'finding']) {
      expect(route, `route.ts still names "${dead}"`).not.toMatch(
        new RegExp(`['"]${dead}['"]`),
      );
    }
  });

  it('leaves no dead library behind', () => {
    const libs = readdirSync(join(SRC, 'lib'));
    for (const gone of ['flow.ts', 'flowLayout.ts', 'patterns.ts', 'findings.ts', 'chips.ts', 'chart.ts']) {
      expect(libs, gone).not.toContain(gone);
    }
  });

  it('keeps no unused charting dependency in the manifest', () => {
    const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const gone of ['d3-sankey', 'd3-shape', '@types/d3-sankey', '@types/d3-shape', 'recharts']) {
      expect(Object.keys(deps), gone).not.toContain(gone);
    }
  });

  it('imports every module it declares, so nothing in the tree is unreachable', () => {
    const modules = code
      .map((f) => f.slice(SRC.length).replace(/\\/g, '/'))
      .filter((f) => !/\/(main|App)\.tsx$/.test(f));
    const body = all.map((a) => a.body).join('\n');
    for (const m of modules) {
      const name = m.split('/').pop()!.replace(/\.tsx?$/, '');
      if (name === 'types' || name.endsWith('.d')) continue;
      expect(body, `${m} is never imported`).toMatch(new RegExp(`['"][^'"]*${name}['"]`));
    }
  });
});

describe('voice', () => {
  // CLAUDE.md names these. They are banned because nobody talks like
  // that, and a reader notices immediately.
  const BANNED = [
    /\bleverage[sd]?\b(?!\s*ratio)/i,
    /\bseamless(ly)?\b/i,
    /\brobust\b/i,
    /\bdelve\b/i,
    /\bnot simply\b/i,
    /\boscillat/i,
    /\bunlock(s|ing)?\b/i,
    /\bempower/i,
    /\bcutting[- ]edge\b/i,
    /\bgame[- ]chang/i,
  ];

  it('uses none of the banned constructions anywhere in the source', () => {
    for (const { file, body } of all) {
      for (const pattern of BANNED) {
        expect(body, `${file} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('uses no emoji, per the design system', () => {
    // Emoji, not typographic marks: ✓ and ✗ carry the condition state
    // and are set in the page's own type, which is the point of them.
    for (const { file, body } of all) {
      expect(body, file).not.toMatch(/[\u{1F300}-\u{1FAFF}]|\u{FE0F}/u);
    }
  });
});

describe('the type ramp and the 16px floor', () => {
  it('declares no font-size in raw pixels outside the ramp', () => {
    const rules = css.split('\n').filter((l) => /font-size\s*:/.test(l));
    for (const rule of rules) {
      expect(rule, `raw pixel font-size: ${rule.trim()}`).toMatch(/var\(--t-|font-size:\s*0?\.\d+em|1em/);
    }
  });

  it('sets the reading size at or above 16px', () => {
    const sm = css.match(/--t-sm:\s*(\d+)px/)![1];
    const md = css.match(/--t-md:\s*(\d+)px/)![1];
    expect(Number(sm)).toBeGreaterThanOrEqual(16);
    expect(Number(md)).toBeGreaterThanOrEqual(16);
  });

  it('keeps the ramp monotonic', () => {
    const steps = ['--t-2xs', '--t-xs', '--t-sm', '--t-md', '--t-lg', '--t-xl', '--t-2xl', '--t-3xl', '--t-4xl'];
    const sizes = steps.map((s) => Number(css.match(new RegExp(`${s}:\\s*(\\d+)px`))![1]));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i], steps[i]).toBeGreaterThan(sizes[i - 1]);
    }
  });
});

describe('the named defects cannot come back', () => {
  it('renders the collector’s health on the maintenance surface only', () => {
    for (const { file, body } of all) {
      if (/MaintenanceView|lib\/health|lib\/supabase/.test(file)) continue;
      expect(body, `${file} reads fetch_runs`).not.toContain('fetch_runs');
      expect(body, `${file} imports warnings()`).not.toMatch(/from\s+['"].*lib\/health['"][\s\S]{0,80}warnings/);
    }
  });

  it('uses no native title attribute as the only way to learn a term', () => {
    // `title=` was the mechanism for ~30 definitions and is invisible on
    // touch, unreachable by keyboard and uncopyable.
    for (const { file, body } of all) {
      expect(body, `${file} uses a title attribute`).not.toMatch(/\stitle=\{/);
      expect(body, `${file} uses a title attribute`).not.toMatch(/\stitle="/);
    }
  });

  it('positions nothing absolutely over the content it explains', () => {
    // The definition panel expands in flow; nothing overlays a row.
    expect(css).not.toMatch(/\.term-body[^}]*position:\s*(absolute|fixed)/s);
    expect(css).not.toContain('.chart-tip');
    expect(css).not.toContain('.tray');
  });

  it('never renders a bare em dash as a value', () => {
    for (const { file, body } of all) {
      if (file.includes('lib/format')) continue; // usd() returns it for a true null
      expect(body, `${file} renders a bare —`).not.toMatch(/>\s*—\s*</);
      expect(body, `${file} renders a bare —`).not.toMatch(/\{'—'\}/);
    }
  });

  it('gives the gap bar its figures in words rather than an unlabelled hatch', () => {
    const bar = text(join(SRC, 'components', 'GapBar.tsx'));
    expect(bar).toContain('aria-label');
    expect(bar).toContain('traceable');
    expect(bar).toContain('GapKey');
  });

  it('keeps the signature bar square and flat, per the design system', () => {
    expect(css).not.toMatch(/border-radius:\s*[1-9]/);
    expect(css).not.toMatch(/\.gapbar[^}]*border-radius/s);
    expect(css).not.toContain('linear-gradient(135deg');
  });

  it('never renders the company verdict in capitals', () => {
    expect(css).toMatch(/\.company-verdict[^}]*text-transform:\s*none/s);
    expect(css).not.toMatch(/\.company-verdict[^}]*text-transform:\s*uppercase/s);
  });
});

describe('accessibility and layout guarantees', () => {
  it('offers a skip link', () => {
    expect(text(join(SRC, 'App.tsx'))).toContain('Skip to content');
    expect(css).toContain('.skip-link');
  });

  it('never removes a focus ring without replacing it', () => {
    expect(css).toContain(':focus-visible');
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px/s);
  });

  it('honours prefers-reduced-motion in one place', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]{0,400}animation-duration:\s*0\.001ms/);
  });

  it('styles the scrollbar once, globally', () => {
    expect(css).toContain('scrollbar-color');
    expect(css).toContain('::-webkit-scrollbar');
  });

  it('forbids sideways scrolling of the page', () => {
    expect(css).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*hidden/s);
  });

  it('gives every interactive element a real button or anchor, never a clickable div', () => {
    for (const { file, body } of all) {
      expect(body, `${file} has an onClick on a div`).not.toMatch(/<div[^>]*\sonClick/);
      expect(body, `${file} has an onClick on a span`).not.toMatch(/<span[^>]*\sonClick/);
      expect(body, `${file} has an onClick on an li`).not.toMatch(/<li[^>]*\sonClick/);
    }
  });

  it('types every button, so none of them submits a form by accident', () => {
    for (const { file, live } of all) {
      const buttons = live.match(/<button[^>]*>/g) ?? [];
      for (const b of buttons) {
        expect(b, `${file}: ${b}`).toMatch(/type=/);
      }
    }
  });

  it('starts every view at h2, since the masthead owns the h1', () => {
    for (const { file, body } of all) {
      if (!file.startsWith('/views/')) continue;
      expect(body, `${file} declares an h1`).not.toContain('<h1');
    }
  });

  it('never writes a heading below h2 before an h2 in the same view', () => {
    for (const { file, body } of all) {
      if (!file.startsWith('/views/')) continue;
      const first = body.search(/<h[23]/);
      if (first === -1) continue;
      expect(body.slice(first, first + 4), file).toMatch(/<h2|<h3/);
    }
  });

  it('labels every expander with what it controls', () => {
    const term = text(join(SRC, 'components', 'Term.tsx'));
    expect(term).toContain('aria-expanded');
    expect(term).toContain('aria-controls');
    expect(term).toContain('Escape');
  });
});

describe('the service-role key never reaches the browser', () => {
  it('appears nowhere in web/src', () => {
    for (const { file, body } of all) {
      expect(body, file).not.toContain('SERVICE_ROLE');
      expect(body, file).not.toContain('service_role');
    }
  });
});
