import { chromium } from '@playwright/test';

/**
 * Checks that cannot be made from a screenshot: does tabbing reach the
 * diagram, does Enter on a node filter the app, does the pin survive a
 * reload, and does anything animate when the reader has asked it not to.
 */

const BASE = process.env.SHOT_BASE ?? 'http://localhost:5199';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch();

// ── keyboard reaches the diagram, and Enter filters ──────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/#/flow`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const skip = await page.evaluate(() => {
    const el = document.querySelector('.skip-link');
    return el ? el.textContent.trim() : null;
  });
  check('a skip link exists', skip === 'Skip to content', skip ?? 'missing');

  // Tab until focus lands inside the diagram.
  let landed = false;
  for (let i = 0; i < 90 && !landed; i++) {
    await page.keyboard.press('Tab');
    landed = await page.evaluate(() => !!document.activeElement?.closest('.flow-node'));
  }
  check('keyboard reaches a flow node', landed);

  if (landed) {
    const label = await page.evaluate(() =>
      document.activeElement?.closest('.flow-node')?.getAttribute('aria-label') ?? '');
    check('the focused node announces itself', /Filter the ledger to this/.test(label), label.slice(0, 60));

    const outline = await page.evaluate(() => {
      const rect = document.activeElement.querySelector('rect');
      return getComputedStyle(rect).outlineStyle;
    });
    check('focus is visible on the node', outline !== 'none', `outline-style: ${outline}`);

    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const hash = await page.evaluate(() => location.hash);
    check('Enter filters the app and writes the URL', /[?&](dest|basis|co)=/.test(hash), hash);
  }
  await page.close();
}

// ── a pinned comparison survives a reload ────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/#/patterns`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.locator('.pattern-card .pin').first().click();
  await page.waitForTimeout(200);

  const hash = await page.evaluate(() => location.hash);
  check('pinning writes the URL', /pin=/.test(hash), hash);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const trayRows = await page.locator('.tray-row').count();
  check('the tray survives a reload', trayRows === 1, `${trayRows} row(s)`);
  await page.close();
}

// ── reduced motion is respected ──────────────────────────────────────
{
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  await page.goto(`${BASE}/#/flow`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const durations = await page.evaluate(() =>
    [...document.querySelectorAll('.flow-link, .pattern-card, .flow-node rect')]
      .map((el) => getComputedStyle(el).transitionDuration)
      .filter((d, i, a) => a.indexOf(d) === i));
  check(
    'nothing transitions under reduced motion',
    durations.every((d) => d === '0s'),
    durations.join(', ') || 'no elements',
  );
  await page.close();
}

// ── chips are real toggles ───────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(`${BASE}/#/patterns`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const chip = page.locator('.pattern-card .chip').first();
  const before = await chip.getAttribute('aria-pressed');
  await chip.click();
  await page.waitForTimeout(250);
  const after = await page.locator('.pattern-card .chip').first().getAttribute('aria-pressed');
  check('a chip reports pressed state', before === 'false', `before=${before}`);
  check('clicking a chip filters', (await page.evaluate(() => location.hash)).includes('='), after ?? '');
  await page.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} check(s) failed.` : '\nAll accessibility checks passed.');
process.exit(failed.length ? 1 : 0);
