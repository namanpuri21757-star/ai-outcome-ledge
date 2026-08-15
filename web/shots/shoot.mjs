import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Screenshot every view, so a design decision can be looked at rather
 * than reasoned about.
 *
 *   VITE_FIXTURES=1 npx vite --port 5199
 *   node shots/shoot.mjs
 *
 * Writes to shots/out/, which is git-ignored: these are working
 * artefacts for judging a layout, not something to commit.
 */

const BASE = process.env.SHOT_BASE ?? 'http://localhost:5199';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const SHOTS = [
  ['flow', '#/flow', { width: 1440, height: 1200 }],
  ['flow-filtered', '#/flow?dest=1', { width: 1440, height: 1100 }],
  // The held node: the diagram fades around it and the rows behind it
  // appear alongside rather than below.
  ['flow-focus', '#/flow?focus=dest%3A5', { width: 1440, height: 1200 }],
  ['flow-focus-narrow', '#/flow?focus=dest%3A5', { width: 1100, height: 1400 }],
  ['patterns', '#/patterns', { width: 1440, height: 1500 }],
  ['patterns-conditions', '#/patterns?condn=3', { width: 1440, height: 1000 }],
  ['patterns-pinned', '#/patterns?pin=northwind,acme-group,meridian', { width: 1440, height: 1200 }],
  // Both halves of the margin panel: a company whose filings produce a
  // series, and one that files nothing. The empty state is the common
  // case in the real ledger, so it is screenshotted rather than assumed.
  ['company', '#/company/castleford', { width: 1440, height: 1600 }],
  ['company-no-series', '#/company/northwind', { width: 1440, height: 900 }],
  ['companies', '#/companies', { width: 1440, height: 1300 }],
  ['companies-mobile', '#/companies', { width: 390, height: 1200 }],
  ['ledger', '#/ledger', { width: 1440, height: 1000 }],
  ['ledger-mobile', '#/ledger', { width: 390, height: 1200 }],
  ['conditions', '#/conditions', { width: 1440, height: 1000 }],
  ['flow-mobile', '#/flow', { width: 390, height: 1400 }],
  ['patterns-mobile', '#/patterns', { width: 390, height: 1400 }],
  ['flow-empty', '#/flow?q=zzzznothingmatches', { width: 1440, height: 700 }],
  ['patterns-empty', '#/patterns?q=zzzznothingmatches', { width: 1440, height: 600 }],
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
let failed = 0;

for (const [name, hash, viewport] of SHOTS) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });

  // A console error is a defect even when the pixels look right.
  // The exception is the health strip's call to the placeholder
  // Supabase host, which cannot resolve under fixtures by design.
  const real = errors.filter(
    (e) => !/favicon|supabase|Failed to fetch|ERR_NAME_NOT_RESOLVED/i.test(e),
  );
  if (real.length) {
    failed += 1;
    console.log(`✗ ${name}: ${real.slice(0, 2).join(' | ')}`);
  } else {
    console.log(`✓ ${name}`);
  }
  await page.close();
}

await browser.close();
console.log(failed ? `\n${failed} view(s) logged a console error.` : '\nNo console errors.');
