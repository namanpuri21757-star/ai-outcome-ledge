import { describe, expect, it } from 'vitest';
import { CONCEPTS, companyFactsUrl, extractSeries, padCik, parseTickerMap, pickConcept } from '../src/sec';

describe('padCik', () => {
  it('zero-pads to ten digits, which the API requires', () => {
    expect(padCik(320193)).toBe('0000320193');
    expect(padCik('51143')).toBe('0000051143');
  });
  it('strips any non-digits so "CIK0000320193" round-trips', () => {
    expect(padCik('CIK0000320193')).toBe('0000320193');
  });
});

describe('companyFactsUrl', () => {
  it('builds the documented endpoint', () => {
    expect(companyFactsUrl('51143')).toBe(
      'https://data.sec.gov/api/xbrl/companyfacts/CIK0000051143.json',
    );
  });
});

describe('parseTickerMap', () => {
  const sample = {
    '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
    '1': { cik_str: 51143, ticker: 'IBM', title: 'International Business Machines' },
  };

  it('reads the index-keyed object shape the SEC actually serves', () => {
    const map = parseTickerMap(sample);
    expect(map.get('IBM')).toBe('0000051143');
    expect(map.size).toBe(2);
  });

  it('is case insensitive on the lookup key', () => {
    expect(parseTickerMap(sample).get('aapl'.toUpperCase())).toBe('0000320193');
  });

  it('keeps the first entry for a duplicated ticker, which is the larger filer', () => {
    const map = parseTickerMap({
      '0': { cik_str: 111, ticker: 'DUP' },
      '1': { cik_str: 222, ticker: 'DUP' },
    });
    expect(map.get('DUP')).toBe('0000000111');
  });

  it('returns an empty map rather than throwing on junk', () => {
    expect(parseTickerMap(null).size).toBe(0);
    expect(parseTickerMap({ '0': { ticker: 'NOCIK' } }).size).toBe(0);
  });
});

const factsFixture = (tags: Record<string, any>) => ({
  cik: 51143,
  entityName: 'Test Co',
  facts: { 'us-gaap': tags },
});

const usd = (facts: any[]) => ({ units: { USD: facts } });
const period = (start: string, end: string, val: number, form = '10-Q') => ({
  start, end, val, form, filed: end, accn: `a-${end}`,
});

describe('pickConcept', () => {
  it('takes the first tag in the fallback chain that the filer reports', () => {
    const f = factsFixture({ Revenues: usd([period('2025-01-01', '2025-03-31', 5)]) });
    const picked = pickConcept(f, CONCEPTS.revenue_q);
    expect(picked?.tag).toBe('Revenues');
  });

  it('prefers the modern revenue tag when both are present', () => {
    const f = factsFixture({
      Revenues: usd([period('2025-01-01', '2025-03-31', 5)]),
      RevenueFromContractWithCustomerExcludingAssessedTax: usd([period('2025-01-01', '2025-03-31', 6)]),
    });
    expect(pickConcept(f, CONCEPTS.revenue_q)?.tag).toBe(
      'RevenueFromContractWithCustomerExcludingAssessedTax',
    );
  });

  it('skips a tag that exists but has an empty USD array', () => {
    const f = factsFixture({
      RevenueFromContractWithCustomerExcludingAssessedTax: usd([]),
      Revenues: usd([period('2025-01-01', '2025-03-31', 5)]),
    });
    expect(pickConcept(f, CONCEPTS.revenue_q)?.tag).toBe('Revenues');
  });

  it('returns null when the company files no us-gaap facts at all', () => {
    expect(pickConcept({ facts: {} } as any, CONCEPTS.revenue_q)).toBeNull();
    expect(pickConcept({} as any, CONCEPTS.revenue_q)).toBeNull();
  });
});

describe('extractSeries', () => {
  const facts = factsFixture({
    Revenues: usd([
      period('2024-01-01', '2024-03-31', 1000),
      period('2024-04-01', '2024-06-30', 1100),
      period('2024-07-01', '2024-09-30', 1200),
      period('2024-01-01', '2024-12-31', 4600, '10-K'),
    ]),
    OperatingIncomeLoss: usd([
      period('2024-01-01', '2024-03-31', 100),
      period('2024-04-01', '2024-06-30', 121),
      period('2024-07-01', '2024-09-30', 120),
      period('2024-01-01', '2024-12-31', 441, '10-K'),
    ]),
    CostOfRevenue: usd([period('2024-01-01', '2024-03-31', 600)]),
  });

  it('produces revenue, operating income and a derived margin series', () => {
    const series = extractSeries(facts, '2020-01-01');
    const keys = series.map((s) => s.key).sort();
    expect(keys).toContain('revenue_q');
    expect(keys).toContain('operating_income_q');
    expect(keys).toContain('operating_margin_q');
    expect(keys).toContain('gross_margin_q');
  });

  it('derives the fourth quarter for both revenue and income', () => {
    const rev = extractSeries(facts, '2020-01-01').find((s) => s.key === 'revenue_q')!;
    expect(rev.points.find((p) => p.end === '2024-12-31')?.value).toBe(1300);
    const oi = extractSeries(facts, '2020-01-01').find((s) => s.key === 'operating_income_q')!;
    expect(oi.points.find((p) => p.end === '2024-12-31')?.value).toBe(100);
  });

  it('computes margin on the derived quarter too', () => {
    const margin = extractSeries(facts, '2020-01-01').find((s) => s.key === 'operating_margin_q')!;
    const q4 = margin.points.find((p) => p.end === '2024-12-31')!;
    expect(q4.value).toBeCloseTo(100 / 1300, 6);
  });

  it('marks derived points so a chart can distinguish them from filed ones', () => {
    const rev = extractSeries(facts, '2020-01-01').find((s) => s.key === 'revenue_q')!;
    expect(rev.points.find((p) => p.end === '2024-12-31')?.ref).toMatch(/^derived:/);
  });

  it('honours the since cutoff', () => {
    const series = extractSeries(facts, '2024-07-01');
    const rev = series.find((s) => s.key === 'revenue_q')!;
    expect(rev.points.every((p) => p.end >= '2024-07-01')).toBe(true);
  });

  it('returns an empty array for a filer with no usable concepts', () => {
    expect(extractSeries(factsFixture({ SomethingElse: usd([]) }))).toEqual([]);
  });
});
