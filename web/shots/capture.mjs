import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Screenshot a list of routes at both widths into a named directory.
 *
 *   SHOT_BASE=http://localhost:5199 SHOT_DIR=../docs/rebuild/before \
 *     node shots/capture.mjs flow=#/flow ledger=#/ledger
 *
 * Every argument is `name=hash`. Console errors are reported but do not
 * stop the run: the point of a before-capture is to record the defects,
 * not to assert their absence.
 */

const BASE = process.env.SHOT_BASE ?? 'http://localhost:5199';
const DIR = process.env.SHOT_DIR ?? 'shots/out';
const WIDTHS = [
  ['1440', 1440, 1400],
  ['390', 390, 1600],
];

const shots = process.argv.slice(2).map((arg) => {
  const at = arg.indexOf('=');
  return [arg.slice(0, at), arg.slice(at + 1)];
});

mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
let errors = 0;

for (const [name, hash] of shots) {
  for (const [suffix, width, height] of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const found = [];
    page.on('pageerror', (e) => found.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') found.push(m.text()); });

    await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${DIR}/${name}-${suffix}.png`, fullPage: true });
    await page.close();

    if (found.length) {
      errors += found.length;
      console.log(`  ! ${name}-${suffix}: ${found.length} console error(s)`);
      for (const e of found.slice(0, 3)) console.log(`      ${e.slice(0, 160)}`);
    } else {
      console.log(`  ✓ ${name}-${suffix}`);
    }
  }
}

await browser.close();
console.log(`\n${shots.length} routes × ${WIDTHS.length} widths → ${DIR}  (${errors} console errors)`);
