import type { XbrlFact } from './types';
import { toQuarterlySeries, computeMarginSeries } from './quarterly';

/**
 * SEC EDGAR XBRL. Free, no key, no registration. Two hard rules:
 *   - a User-Agent naming you and a contact email, or you get 403
 *   - stay under 10 requests a second
 */

export const SEC_TICKER_MAP_URL = 'https://www.sec.gov/files/company_tickers.json';

export function companyFactsUrl(cik: string): string {
  return `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`;
}

export function padCik(cik: string | number): string {
  return String(cik).replace(/\D/g, '').padStart(10, '0');
}

/**
 * Parse https://www.sec.gov/files/company_tickers.json, which is an object
 * keyed by row index rather than an array.
 *
 * Resolving CIKs at runtime instead of hardcoding them is deliberate: a wrong
 * CIK does not error, it quietly returns a different company's financials.
 */
export function parseTickerMap(json: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!json || typeof json !== 'object') return out;
  for (const entry of Object.values(json as Record<string, any>)) {
    if (!entry || typeof entry !== 'object') continue;
    const ticker = entry.ticker;
    const cik = entry.cik_str ?? entry.cik;
    if (typeof ticker !== 'string' || cik === undefined) continue;
    const key = ticker.toUpperCase();
    // First occurrence wins: the file is ordered by market cap, so for a
    // duplicated ticker the larger filer is the intended one.
    if (!out.has(key)) out.set(key, padCik(cik));
  }
  return out;
}

/** us-gaap tags in preference order. Filers disagree about which to use, and
 *  the same filer changes over time, so every concept needs a fallback chain. */
export const CONCEPTS: Record<string, string[]> = {
  revenue_q: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'SalesRevenueNet',
    'SalesRevenueServicesNet',
  ],
  operating_income_q: [
    'OperatingIncomeLoss',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
  ],
  cost_of_revenue_q: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfServices'],
  opex_q: ['OperatingExpenses', 'CostsAndExpenses'],
  rnd_q: ['ResearchAndDevelopmentExpense'],
  net_income_q: ['NetIncomeLoss'],
};

export interface CompanyFacts {
  cik?: number;
  entityName?: string;
  facts?: { [taxonomy: string]: { [tag: string]: { units?: { [unit: string]: XbrlFact[] } } } };
}

/** Pick the first tag in the chain that the filer actually reports in USD. */
export function pickConcept(
  facts: CompanyFacts,
  candidates: string[],
  unit = 'USD',
): { tag: string; facts: XbrlFact[] } | null {
  const gaap = facts?.facts?.['us-gaap'];
  if (!gaap) return null;
  for (const tag of candidates) {
    const arr = gaap[tag]?.units?.[unit];
    if (Array.isArray(arr) && arr.length > 0) return { tag, facts: arr };
  }
  return null;
}

export interface ExtractedSeries {
  key: string;
  unit: string;
  points: Array<{ end: string; value: number; fiscalPeriod: string; ref?: string }>;
  sourceTag?: string;
}

/**
 * Everything we want from one companyfacts payload, already normalised to
 * discrete quarters. Ratio series (margins) are computed here rather than in
 * the database so that a period mismatch can be refused rather than averaged.
 */
export function extractSeries(facts: CompanyFacts, sinceIso = '2019-01-01'): ExtractedSeries[] {
  const out: ExtractedSeries[] = [];
  const quarterly: Record<string, ReturnType<typeof toQuarterlySeries>> = {};

  for (const [key, candidates] of Object.entries(CONCEPTS)) {
    const picked = pickConcept(facts, candidates);
    if (!picked) continue;
    const series = toQuarterlySeries(picked.facts).filter((p) => p.end >= sinceIso);
    if (series.length === 0) continue;
    quarterly[key] = series;
    out.push({
      key,
      unit: 'usd',
      sourceTag: picked.tag,
      points: series.map((p) => ({
        end: p.end,
        value: p.val,
        fiscalPeriod: p.fiscalPeriod,
        ref: p.origin === 'derived' ? `derived:${p.accn ?? ''}` : p.accn,
      })),
    });
  }

  if (quarterly.revenue_q && quarterly.operating_income_q) {
    const margin = computeMarginSeries(quarterly.revenue_q, quarterly.operating_income_q);
    if (margin.length) {
      out.push({
        key: 'operating_margin_q',
        unit: 'ratio',
        points: margin.map((m) => ({ end: m.end, value: m.value, fiscalPeriod: m.fiscalPeriod })),
      });
    }
  }

  if (quarterly.revenue_q && quarterly.cost_of_revenue_q) {
    const rev = new Map(quarterly.revenue_q.map((r) => [r.end, r.val]));
    const gm = quarterly.cost_of_revenue_q
      .filter((c) => {
        const r = rev.get(c.end);
        return r !== undefined && r > 0;
      })
      .map((c) => {
        const r = rev.get(c.end)!;
        return {
          end: c.end,
          value: Math.round(((r - c.val) / r) * 1e6) / 1e6,
          fiscalPeriod: c.fiscalPeriod,
        };
      });
    if (gm.length) out.push({ key: 'gross_margin_q', unit: 'ratio', points: gm });
  }

  return out;
}

/** Fetch with the required header and a clear error rather than a silent empty. */
export async function secFetch(url: string, userAgent: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent, Accept: 'application/json' },
  });
  if (res.status === 403) {
    throw new Error(
      `SEC returned 403 for ${url}. The SEC_USER_AGENT secret must look like "Ledger name@example.com".`,
    );
  }
  if (res.status === 404) throw new Error(`SEC has no XBRL data at ${url} (404).`);
  if (!res.ok) throw new Error(`SEC returned ${res.status} for ${url}`);
  return res.json();
}
