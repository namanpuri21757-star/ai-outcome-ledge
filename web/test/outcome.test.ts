import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BASELINE_LOOKBACK_DAYS, Q1_TOLERANCE_DAYS, Q4_TOLERANCE_DAYS, STATUS_SHORT,
  addDays, claimScale, marginCaveat, marginWindow, measuredCount,
} from '../src/lib/outcome';
import { MARGIN_SERIES_FIXTURE, REVENUE_SERIES_FIXTURE, row } from './fixtures';

/* ===================================================================
   Every branch here ends in a sentence a reader can act on. The thing
   being tested is not only the arithmetic but that a blank is never
   blank — 84 of 84 rows showed an em dash in the previous build, and no
   test failed.
   =================================================================== */

describe('marginWindow: measured', () => {
  const w = marginWindow(row({ claim_date: '2025-03-31' }), MARGIN_SERIES_FIXTURE);

  it('takes the baseline from the last quarter filed at or before the claim', () => {
    expect(w.baseline).toEqual({ date: '2025-03-31', value: 0.19 });
  });

  it('finds the quarter about 91 days later', () => {
    expect(w.q1).toEqual({ date: '2025-06-30', value: 0.2 });
  });

  it('finds the quarter about a year later', () => {
    expect(w.q4).toEqual({ date: '2026-03-31', value: 0.24 });
  });

  it('states the deltas in basis points', () => {
    expect(w.delta1qBps).toBeCloseTo(100, 1);
    expect(w.delta4qBps).toBeCloseTo(500, 1);
  });

  it('reports the coverage that exists, so the reader can check it', () => {
    expect(w.coverage).toEqual({ first: '2024-03-31', last: '2026-06-30' });
  });

  it('says what happened in a sentence naming both dates', () => {
    expect(w.status).toBe('measured');
    expect(w.hasFigure).toBe(true);
    expect(w.reason).toContain('rose');
    expect(w.reason).toContain('2025-03-31');
    expect(w.reason).toContain('2026-03-31');
  });
});

describe('marginWindow: every way it can fail to produce a figure', () => {
  it('says a research population is not a company that failed to file', () => {
    const w = marginWindow(row({ group_code: 'R', company_is_public: false }), undefined);
    expect(w.status).toBe('not_a_company');
    expect(w.reason).toContain('population-level research');
    expect(w.hasFigure).toBe(false);
  });

  it('says a private company is not an SEC filer, and that this is not a gap', () => {
    const w = marginWindow(row({ company_is_public: false, company_name: 'Klarna' }), undefined);
    expect(w.status).toBe('not_a_filer');
    expect(w.reason).toContain('Klarna is not an SEC filer');
    expect(w.reason).toContain('not a gap in the collection');
  });

  it('distinguishes a filer that publishes no readable series', () => {
    const w = marginWindow(row({ company_is_public: true }), []);
    expect(w.status).toBe('no_series');
    expect(w.reason).toContain('files with the SEC');
  });

  it('says when the series starts after the claim', () => {
    const w = marginWindow(row({ claim_date: '2020-01-01' }), MARGIN_SERIES_FIXTURE);
    expect(w.status).toBe('series_starts_late');
    expect(w.reason).toContain('2024-03-31');
    expect(w.reason).toContain('2020-01-01');
  });

  it('refuses a baseline older than the lookback window and says how old', () => {
    const w = marginWindow(row({ claim_date: '2028-01-01' }), MARGIN_SERIES_FIXTURE);
    expect(w.status).toBe('baseline_stale');
    expect(w.reason).toContain(String(BASELINE_LOOKBACK_DAYS));
  });

  it('separates "not measurable yet" from "not measurable"', () => {
    const w = marginWindow(row({ claim_date: '2026-06-30' }), MARGIN_SERIES_FIXTURE);
    expect(w.status).toBe('too_soon');
    expect(w.baseline).not.toBeNull();
    expect(w.reason).toContain('not measurable yet rather than not measurable');
  });

  it('never returns an empty reason, whatever the branch', () => {
    const cases = [
      marginWindow(row({ group_code: 'R' }), undefined),
      marginWindow(row({ company_is_public: false }), undefined),
      marginWindow(row({ company_is_public: true }), []),
      marginWindow(row({ claim_date: '2020-01-01' }), MARGIN_SERIES_FIXTURE),
      marginWindow(row({ claim_date: '2026-06-30' }), MARGIN_SERIES_FIXTURE),
      marginWindow(row({ claim_date: '2025-03-31' }), MARGIN_SERIES_FIXTURE),
    ];
    for (const w of cases) {
      expect(w.reason.length).toBeGreaterThan(30);
      expect(w.reason.trim().endsWith('.')).toBe(true);
    }
  });

  it('has short words for every status, so a dense row never shows a dash', () => {
    for (const s of ['measured', 'too_soon', 'series_starts_late', 'baseline_stale',
                     'no_series', 'not_a_filer', 'not_a_company'] as const) {
      expect(STATUS_SHORT[s]).toBeTruthy();
      expect(STATUS_SHORT[s]).not.toContain('—');
    }
  });
});

describe('the caveat is never optimistic', () => {
  it('refuses to call a movement evidence', () => {
    const w = marginWindow(row({ claim_date: '2025-03-31' }), MARGIN_SERIES_FIXTURE);
    const text = marginCaveat(w, row({ company_name: 'Acme Corp' }));
    expect(text).toContain('is not evidence for it');
    expect(text).toContain('no part of this figure has been attributed to AI');
  });

  it('says a flat margin is not a refutation either', () => {
    const flat = [
      { date: '2025-03-31', value: 0.2 },
      { date: '2025-06-30', value: 0.2 },
      { date: '2026-03-31', value: 0.2 },
    ];
    const w = marginWindow(row({ claim_date: '2025-03-31' }), flat);
    expect(marginCaveat(w, row())).toContain('not proof the claim is wrong');
  });

  it('says nothing at all when there is no figure to caveat', () => {
    expect(marginCaveat(marginWindow(row({ company_is_public: false }), undefined), row())).toBe('');
  });
});

describe('claimScale', () => {
  it('sizes the claim against four filed quarters of revenue', () => {
    const s = claimScale(
      row({ claimed_amount_usd: 460_000_000, claim_date: '2025-06-30' }),
      REVENUE_SERIES_FIXTURE,
    );
    expect(s).not.toBeNull();
    expect(s!.revenueUsd).toBe(4_600_000_000);
    expect(s!.sharePct).toBeCloseTo(10, 6);
    expect(s!.toDate).toBe('2025-06-30');
    expect(s!.fromDate).toBe('2024-09-30');
  });

  it('returns nothing rather than guessing on fewer than four quarters', () => {
    expect(claimScale(row({ claim_date: '2025-06-30' }), REVENUE_SERIES_FIXTURE.slice(0, 3))).toBeNull();
  });

  it('returns nothing when the claim named no dollars', () => {
    expect(claimScale(row({ claimed_amount_usd: null }), REVENUE_SERIES_FIXTURE)).toBeNull();
  });

  it('returns nothing when no revenue was collected', () => {
    expect(claimScale(row(), undefined)).toBeNull();
    expect(claimScale(row(), [])).toBeNull();
  });

  it('only uses quarters filed at or before the claim', () => {
    const s = claimScale(
      row({ claimed_amount_usd: 100, claim_date: '2025-03-31' }),
      REVENUE_SERIES_FIXTURE,
    );
    expect(s).toBeNull(); // only three quarters precede that date
  });
});

describe('measuredCount', () => {
  it('splits measured, not yet, and not at all', () => {
    const windows = [
      marginWindow(row({ claim_date: '2025-03-31' }), MARGIN_SERIES_FIXTURE),
      marginWindow(row({ claim_date: '2026-06-30' }), MARGIN_SERIES_FIXTURE),
      marginWindow(row({ company_is_public: false }), undefined),
    ];
    expect(measuredCount(windows)).toEqual({ measured: 1, tooSoon: 1, impossible: 1 });
  });

  it('is all zeroes for no claims', () => {
    expect(measuredCount([])).toEqual({ measured: 0, tooSoon: 0, impossible: 0 });
  });
});

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2025-01-30', 3)).toBe('2025-02-02');
  });
  it('crosses a leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });
  it('goes backwards', () => {
    expect(addDays('2025-01-01', -1)).toBe('2024-12-31');
  });
});

/* ===================================================================
   The browser and the collector must agree about the same claim.
   =================================================================== */

describe('the window constants match the collector', () => {
  const worker = readFileSync('../worker/src/outcomes.ts', 'utf8');

  it('uses the same baseline lookback as worker/src/outcomes.ts', () => {
    expect(worker).toContain(`baselineLookbackDays = ${BASELINE_LOOKBACK_DAYS}`);
  });

  it('uses the same one-quarter tolerance', () => {
    expect(worker).toContain(`q1ToleranceDays = ${Q1_TOLERANCE_DAYS}`);
  });

  it('uses the same one-year tolerance', () => {
    expect(worker).toContain(`q4ToleranceDays = ${Q4_TOLERANCE_DAYS}`);
  });
});
