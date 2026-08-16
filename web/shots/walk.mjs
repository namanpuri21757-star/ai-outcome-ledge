import { chromium } from '@playwright/test';

/**
 * The scripted click-through, at both widths, against the built output
 * and real data:
 *
 *   landing page → cold load → headline finding → drill to a company
 *   → drill to a claim
 *   → reach the source → back out → apply a filter → cross-check a total
 *   against another view → hard reload on a deep link → browser back.
 *
 * Every step asserts something. Zero console errors is a pass condition,
 * not a footnote.
 */

const BASE = process.env.SHOT_BASE ?? 'http://localhost:5200';
const results = [];
let failures = 0;

const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch();

for (const [label, width, height] of [['1440px', 1440, 900], ['390px', 390, 844]]) {
  console.log(`\n── ${label} ──────────────────────────────────`);
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // ── 0. The landing page, at the bare root ─────────────────────
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.home-headline', { timeout: 15000 });

  const locked =
    'Everyone is spending billions on AI and claiming it is improving their business. But is it really?';
  const hook = (await page.textContent('.home-headline'))?.replace(/\s+/g, ' ').trim();
  check('the landing page carries the locked headline, word for word',
    hook === locked, hook?.slice(0, 48));
  check('the headline is the page h1, since there is no masthead here',
    await page.evaluate(() => !!document.querySelector('h1.home-headline')));

  // The example is one row of the ledger, so its two figures have to be
  // the row's figures — not a rounder pair that reads better.
  const homeFigures = await page.evaluate(() =>
    [...document.querySelectorAll('.home-card-fig-value')].map((e) => e.textContent.trim()));
  await page.click('.home-card-open');
  await page.waitForSelector('.claim-headline');
  const claimText = (await page.textContent('.claim'))?.replace(/\s+/g, ' ') ?? '';
  check("the example figures are the figures on the row itself",
    homeFigures.length === 3 && homeFigures.every((f) => claimText.includes(f)),
    homeFigures.join(' · '));

  await page.goBack({ waitUntil: 'networkidle' });
  await page.waitForSelector('.home-headline');
  const homeOver = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('the landing page does not scroll sideways', homeOver <= 0, `${homeOver}px overflow`);

  // ── 1. Cold load ─────────────────────────────────────────────
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.finding-figure', { timeout: 15000 });

  const share = (await page.textContent('.finding-figure'))?.trim();
  check('the headline figure is a percentage', /^\d+(\.\d+)?%$/.test(share ?? ''), share);

  // ── 2. The finding is legible without scrolling ───────────────
  const aboveFold = await page.evaluate((h) => {
    const fig = document.querySelector('.finding-figure');
    const say = document.querySelector('.finding-say');
    const split = document.querySelector('.finding-split');
    if (!fig || !say || !split) return null;
    return {
      figBottom: fig.getBoundingClientRect().bottom,
      sayBottom: say.getBoundingClientRect().bottom,
      splitBottom: split.getBoundingClientRect().bottom,
      viewport: h,
      scrolled: window.scrollY,
    };
  }, height);
  check(
    'the finding, its sentence and both figures fit above the fold',
    aboveFold && aboveFold.splitBottom <= aboveFold.viewport && aboveFold.scrolled === 0,
    aboveFold ? `bottom ${Math.round(aboveFold.splitBottom)}px of ${aboveFold.viewport}px` : 'missing',
  );

  const clarify = await page.textContent('.finding-clarify');
  check(
    'the standing clarification is on the first screen',
    /does not mean the claim is false/.test(clarify ?? ''),
  );

  // ── 3. No operational banner on a reading view ────────────────
  const opsWords = await page.evaluate(() => {
    const t = document.querySelector('main')?.innerText ?? '';
    return ['warnings', 'Show 22', 'pipeline', 'collector failed', 'job failed']
      .filter((w) => t.includes(w));
  });
  check('no operational error banner on the ledger', opsWords.length === 0, opsWords.join(', '));

  // ── 4. Cross-check: the headline against the destination rows ─
  const consistent = await page.evaluate(() => {
    const parse = (s) => {
      const m = s.match(/\$([\d.]+)([KMBT])?/);
      if (!m) return null;
      const mult = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[m[2]] ?? 1;
      return Number(m[1]) * mult;
    };
    const split = [...document.querySelectorAll('.finding-split strong')].map((e) => parse(e.textContent));
    const bars = [...document.querySelectorAll('.breakdown-item .gapbar-legend')];
    let traced = 0, gap = 0;
    for (const b of bars) {
      const spans = b.querySelectorAll('span');
      if (spans.length < 2) continue;
      traced += parse(spans[0].textContent) ?? 0;
      gap += parse(spans[1].textContent) ?? 0;
    }
    return { headlineTraced: split[0], headlineGap: split[1], traced, gap };
  });
  // Figures are rounded for display, so agreement is to within a rounding step.
  const near = (a, b) => a !== null && b !== null && Math.abs(a - b) <= Math.max(a, b) * 0.02;
  check(
    'the destination rows sum to the headline (traceable)',
    near(consistent.headlineTraced, consistent.traced),
    `${consistent.headlineTraced} vs ${consistent.traced}`,
  );
  check(
    'the destination rows sum to the headline (not traceable)',
    near(consistent.headlineGap, consistent.gap),
    `${consistent.headlineGap} vs ${consistent.gap}`,
  );

  // ── 5. A coded term explains itself in place ──────────────────
  const term = page.locator('.breakdown-item .term-trigger').first();
  await term.click();
  const defOpen = await page.locator('.breakdown-item .term-body').first().isVisible();
  check('a coded term opens its definition in place', defOpen);

  const covers = await page.evaluate(() => {
    const body = document.querySelector('.breakdown-item .term-body');
    if (!body) return true;
    return getComputedStyle(body).position === 'absolute' || getComputedStyle(body).position === 'fixed';
  });
  check('the definition does not overlay the content beneath it', covers === false);
  await term.click();

  // ── 6. Drill to a company ─────────────────────────────────────
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.claimrow-company');
  const companyName = (await page.textContent('.claimrow-company'))?.trim();
  await page.click('.claimrow-company');
  await page.waitForSelector('.company-verdict');

  const verdict = (await page.textContent('.company-verdict'))?.trim() ?? '';
  check('the company page leads with a readable verdict', verdict.length > 40, verdict.slice(0, 60));
  check('the verdict is not set in capitals', verdict !== verdict.toUpperCase());

  const verdictStyle = await page.evaluate(() => {
    const el = document.querySelector('.company-verdict');
    const s = getComputedStyle(el);
    return { transform: s.textTransform, size: parseFloat(s.fontSize) };
  });
  check('the verdict is at least 16px', verdictStyle.size >= 16, `${verdictStyle.size}px`);
  check('the verdict is not uppercased by CSS', verdictStyle.transform === 'none', verdictStyle.transform);

  const scope = await page.textContent('.company-scope');
  check('the company page states its own scope', /Filters set on the ledger are not applied/.test(scope ?? ''));

  // ── 7. Drill to a claim, and reach the source ─────────────────
  await page.click('.claimlist .claimrow-headline');
  await page.waitForSelector('.claim-headline');
  const headline = (await page.textContent('.claim-headline'))?.trim() ?? '';
  check('the claim page shows the claim as asserted', headline.length > 10);

  const sourceBlock = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('h3')];
    const h = heads.find((e) => e.textContent.includes('Where this came from'));
    return h ? h.closest('section').innerText : null;
  });
  check('the source is on the same page as the claim', !!sourceBlock);
  check(
    'a missing source URL is explained rather than left blank',
    /No source URL is recorded|Open the source/.test(sourceBlock ?? ''),
  );
  check('a lookup is offered', /Look it up/.test(sourceBlock ?? '') || /Open the source/.test(sourceBlock ?? ''));

  const marginText = await page.evaluate(() => {
    const s = document.querySelector('.marginwin');
    return s ? s.innerText : null;
  });
  check('the claim states what the filings show, or why they cannot', !!marginText && marginText.length > 60);
  check('no bare em dash stands in for a margin figure', !/\n—\n|\s—\s*$/.test(marginText ?? ''));

  // ── 8. Back out ───────────────────────────────────────────────
  await page.goBack();
  await page.waitForSelector('.company-verdict');
  check('browser back returns to the company', true);
  await page.goBack();
  await page.waitForSelector('.finding-figure');
  check('browser back returns to the ledger', true);

  // ── 9. Apply a filter, and check it does not leak ─────────────
  await page.goto(`${BASE}/#/?dest=5&kind=gain_claim`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.finding-figure');
  const scopeLine = await page.textContent('.rows-scope');
  check('the ledger states how much of itself the filter shows', /rows match this selection|All \d+ rows/.test(scopeLine ?? ''), scopeLine?.trim());

  const filteredCount = await page.evaluate(() => document.querySelectorAll('.claimlist .claimrow').length);
  check('the filter actually narrows the list', filteredCount > 0, `${filteredCount} rows`);

  // The company page must ignore it entirely.
  await page.click('.claimrow-company');
  await page.waitForSelector('.company-verdict');
  const hash = page.url().split('#')[1];
  check('leaving the ledger drops the filter from the URL', !/dest=|kind=/.test(hash), hash);
  const scopeAfter = await page.textContent('.company-scope');
  check('the company page still shows its whole record', /shows all \d+ rows?/.test(scopeAfter ?? ''));

  await page.goBack();
  await page.waitForSelector('.finding-figure');
  const restored = page.url().split('#')[1];
  check('back restores the filtered ledger', /dest=5/.test(restored), restored);

  // ── 10. Hard reload on a deep link ────────────────────────────
  const deep = `${BASE}/#/?dest=1&dollars=1`;
  await page.goto(deep, { waitUntil: 'networkidle' });
  await page.waitForSelector('.finding-figure');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.finding-figure');
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll('.filters-active .filters-chip')].map((e) => e.textContent.trim()));
  check('a deep link survives a hard reload', chips.length === 2, chips.join(' | '));

  // ── 11. Nothing scrolls sideways ──────────────────────────────
  for (const route of ['#/', '#/method', '#/maintenance']) {
    await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${route} does not scroll sideways`, over <= 0, `${over}px overflow`);
  }

  // ── 12. Keyboard reaches, and Escape closes ───────────────────
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.finding-figure');
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => !!document.activeElement?.classList.contains('term-trigger'));
  }
  check('the keyboard reaches a definition', reached);
  if (reached) {
    const ring = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement);
      return { width: s.outlineWidth, style: s.outlineStyle };
    });
    check('the focused element has a visible ring', ring.style !== 'none' && parseFloat(ring.width) > 0,
      `${ring.style} ${ring.width}`);
    await page.keyboard.press('Enter');
    const opened = await page.evaluate(() =>
      document.activeElement?.getAttribute('aria-expanded') === 'true');
    check('Enter opens the definition', opened);
    await page.keyboard.press('Escape');
    const closed = await page.evaluate(() =>
      document.activeElement?.getAttribute('aria-expanded') === 'false');
    check('Escape closes it again', closed);
  }

  // ── 13. Console ───────────────────────────────────────────────
  check(`zero console errors at ${label}`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

await browser.close();

console.log(`\n${results.length - failures} of ${results.length} checks passed.`);
if (failures) {
  console.log('\nFailed:');
  for (const r of results.filter((r) => !r.ok)) console.log(`  ✗ ${r.name} — ${r.detail}`);
  process.exit(1);
}
