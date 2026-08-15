import { describe, expect, it } from 'vitest';
import { syntheticDataset } from '../src/lib/devData';
import { applyFilters, EMPTY_FILTERS, filterOptions, isFilterActive } from '../src/lib/filters';
import {
  BASIS_ORDER, DESTINATION_ORDER, KIND_ORDER, VERIFICATION_ORDER, destination,
} from '../src/lib/labels';
import { barMax, byDestination, headline, totals } from '../src/lib/aggregate';
import { buildProfiles, findProfile, verdict } from '../src/lib/companies';
import { readout } from '../src/lib/readout';
import { MARGIN_SERIES, REVENUE_SERIES, claimScale, marginWindow } from '../src/lib/outcome';
import { claimRoute, companyRoute, ledgerRoute, parseHash, toHash } from '../src/lib/route';
import { sourceLinks } from '../src/lib/sourceLinks';
import { usd } from '../src/lib/format';
import { toCsv } from '../src/lib/csv';

/* ===================================================================
   The whole app over a whole corpus, without a browser.

   The synthetic dataset is generated to hold the awkward shapes the
   real one has — gain claims with no dollar figure, a traced figure on
   a claim with no dollar figure, filers with no readable series, and
   claims too recent to have a reading a year later — so these run every
   code path the production data runs.
   =================================================================== */

const data = syntheticDataset();
const rows = data.rows;

describe('the fixture corpus really has the awkward shapes', () => {
  it('holds gain claims that name no dollar figure', () => {
    const t = totals(rows);
    expect(t.nonDollarClaims).toBeGreaterThan(0);
    expect(t.dollarClaims).toBeGreaterThan(0);
  });

  it('holds at least one traced figure on a claim with no dollar amount', () => {
    expect(totals(rows).tracedOutsideDenominatorUsd).toBeGreaterThan(0);
  });

  it('holds rows of every kind', () => {
    const kinds = new Set(rows.map((r) => r.claim_kind));
    for (const k of KIND_ORDER) expect(kinds.has(k), k).toBe(true);
  });

  it('holds companies that file and companies that do not', () => {
    expect(rows.some((r) => r.company_is_public)).toBe(true);
    expect(rows.some((r) => !r.company_is_public)).toBe(true);
  });

  it('holds filers with no collected series at all', () => {
    const filers = [...new Set(rows.filter((r) => r.company_is_public).map((r) => r.company_slug))];
    expect(filers.some((s) => !data.series.has(s))).toBe(true);
  });

  it('holds research rows that are not company claims', () => {
    expect(rows.some((r) => r.group_code === 'R')).toBe(true);
  });

  it('never fabricates a source URL, exactly as the real corpus does not', () => {
    expect(rows.every((r) => r.source_url === null)).toBe(true);
  });

  it('is deterministic, so a screenshot difference means a layout change', () => {
    expect(syntheticDataset().rows.map((r) => r.ref)).toEqual(rows.map((r) => r.ref));
  });
});

describe('every row is reachable and self-consistent', () => {
  it('gives every row a unique reference to route by', () => {
    expect(new Set(rows.map((r) => r.ref)).size).toBe(rows.length);
  });

  it('round-trips every claim through its own URL', () => {
    for (const r of rows) {
      const parsed = parseHash(toHash(claimRoute(r.ref)));
      expect(parsed.view).toBe('claim');
      expect(parsed.id).toBe(r.ref);
    }
  });

  it('round-trips every company through its own URL', () => {
    for (const slug of new Set(rows.map((r) => r.company_slug))) {
      expect(parseHash(toHash(companyRoute(slug))).id).toBe(slug);
    }
  });

  it('resolves every row’s company to a profile', () => {
    const profiles = buildProfiles(rows);
    for (const r of rows) expect(findProfile(profiles, r.company_slug), r.ref).not.toBeNull();
  });

  it('gives every row a destination the vocabulary knows', () => {
    for (const r of rows) expect(DESTINATION_ORDER).toContain(r.destination);
  });
});

describe('every company page renders a complete verdict', () => {
  const profiles = buildProfiles(rows);

  it('produces a sentence for every company, with no holes in it', () => {
    for (const p of profiles) {
      const v = verdict(p, usd);
      expect(v, p.slug).not.toContain('undefined');
      expect(v, p.slug).not.toContain('NaN');
      expect(v, p.slug).not.toContain('$NaN');
      expect(v, p.slug).not.toContain('—');
      expect(v.trim().endsWith('.'), p.slug).toBe(true);
    }
  });

  it('never claims a dollar figure for a company that named none', () => {
    for (const p of profiles) {
      if (p.totals.dollarClaims > 0) continue;
      expect(verdict(p, usd), p.slug).not.toMatch(/claims \$\d/);
    }
  });

  it('handles a single-row company without special-casing', () => {
    const single = profiles.filter((p) => p.totals.rows === 1);
    expect(single.length).toBeGreaterThan(0);
    for (const p of single) expect(verdict(p, usd).length).toBeGreaterThan(20);
  });
});

describe('every claim page can state what the filings show', () => {
  it('always produces a reason, for every row in the corpus', () => {
    for (const r of rows) {
      const w = marginWindow(r, data.series.get(r.company_slug)?.get(MARGIN_SERIES));
      expect(w.reason.length, r.ref).toBeGreaterThan(30);
      expect(w.reason, r.ref).not.toContain('undefined');
      expect(w.reason, r.ref).not.toContain('null');
    }
  });

  it('reaches both the measurable and the unmeasurable branch', () => {
    const statuses = new Set(
      rows.map((r) => marginWindow(r, data.series.get(r.company_slug)?.get(MARGIN_SERIES)).status),
    );
    expect(statuses.has('measured')).toBe(true);
    expect(statuses.size).toBeGreaterThan(2);
  });

  it('never produces a scale line with a nonsense percentage', () => {
    for (const r of rows) {
      const s = claimScale(r, data.series.get(r.company_slug)?.get(REVENUE_SERIES));
      if (!s) continue;
      expect(Number.isFinite(s.sharePct), r.ref).toBe(true);
      expect(s.sharePct, r.ref).toBeGreaterThan(0);
      expect(s.revenueUsd, r.ref).toBeGreaterThan(0);
    }
  });

  it('offers a lookup or says nothing, but never fabricates a source link', () => {
    for (const r of rows) {
      for (const l of sourceLinks(r)) {
        expect(l.href, r.ref).toMatch(/^https:\/\//);
      }
    }
  });
});

describe('the ledger holds together under every filter the panel can offer', () => {
  const options = filterOptions(rows, {
    kinds: KIND_ORDER,
    destinations: DESTINATION_ORDER,
    bases: BASIS_ORDER,
    verification: VERIFICATION_ORDER,
  });

  it('offers no chip that matches nothing', () => {
    for (const o of options.kinds) {
      expect(applyFilters(rows, { ...EMPTY_FILTERS, kinds: [o.value] }).length).toBe(o.count);
    }
    for (const o of options.destinations) {
      expect(applyFilters(rows, { ...EMPTY_FILTERS, destinations: [o.value] }).length).toBe(o.count);
    }
    for (const o of options.bases) {
      expect(applyFilters(rows, { ...EMPTY_FILTERS, bases: [o.value] }).length).toBe(o.count);
    }
    for (const o of options.verification) {
      expect(applyFilters(rows, { ...EMPTY_FILTERS, verification: [o.value] }).length).toBe(o.count);
    }
  });

  it('keeps the destination totals summing to the whole for every single-chip state', () => {
    for (const o of options.destinations) {
      const selected = applyFilters(rows, { ...EMPTY_FILTERS, destinations: [o.value] });
      const whole = totals(selected);
      const sum = byDestination(selected).reduce((a, b) => a + b.totals.claimedUsd, 0);
      expect(sum, destination(o.value).name).toBe(whole.claimedUsd);
    }
  });

  it('keeps the headline agreeing with the totals under every single-chip state', () => {
    for (const o of options.kinds) {
      const selected = applyFilters(rows, { ...EMPTY_FILTERS, kinds: [o.value] });
      const h = headline(selected, usd);
      expect(h.claimedUsd).toBe(totals(selected).claimedUsd);
      expect(h.sentence.length).toBeGreaterThan(20);
    }
  });

  it('survives a selection that matches nothing without throwing', () => {
    const none = applyFilters(rows, { ...EMPTY_FILTERS, search: 'zzzznothingmatches' });
    expect(none).toEqual([]);
    expect(() => headline(none, usd)).not.toThrow();
    expect(() => readout(none, usd)).not.toThrow();
    expect(() => buildProfiles(none)).not.toThrow();
    expect(byDestination(none)).toHaveLength(6);
    expect(barMax(none)).toBe(1);
  });

  it('marks a selection as active exactly when a chip is showing', () => {
    expect(isFilterActive(EMPTY_FILTERS)).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTERS, destinations: [5] })).toBe(true);
  });

  it('exports exactly what is on screen, with the raw codes intact', () => {
    const shown = applyFilters(rows, { ...EMPTY_FILTERS, dollarsOnly: true });
    const lines = toCsv(shown).split('\r\n');
    expect(lines.length - 1).toBe(shown.length);
    expect(lines[0]).toContain('destination');
    expect(lines[0]).toContain('measurement_basis');
    expect(lines[0]).toContain('ref');
  });
});

describe('the readout tracks the corpus it is given', () => {
  it('offers only selections that resolve, for the whole corpus and for subsets', () => {
    const subsets = [
      rows,
      applyFilters(rows, { ...EMPTY_FILTERS, kinds: ['gain_claim'] }),
      applyFilters(rows, { ...EMPTY_FILTERS, destinations: [5] }),
      [],
    ];
    for (const subset of subsets) {
      for (const item of readout(subset, usd)) {
        expect(item.answer.trim().endsWith('.')).toBe(true);
        if (!item.select) continue;
        expect(applyFilters(subset, { ...EMPTY_FILTERS, ...item.select }).length).toBe(item.rowCount);
      }
    }
  });
});

describe('a shared link survives a round trip', () => {
  it('reproduces a filtered ledger exactly', () => {
    const filters = { ...EMPTY_FILTERS, destinations: [1, 5], kinds: ['gain_claim' as const], dollarsOnly: true };
    const restored = parseHash(toHash(ledgerRoute(filters))).filters;
    expect(applyFilters(rows, restored).map((r) => r.ref)).toEqual(
      applyFilters(rows, filters).map((r) => r.ref),
    );
  });
});
