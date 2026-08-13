import type { LedgerRow } from './types';

/**
 * Most rows deliberately have no stored source URL: a URL written from
 * memory is worse than none, because it looks verified. Instead we build
 * a search that lands on the right index, so verification is one click
 * from being done rather than being a chore on a list.
 */
export interface SourceLink {
  label: string;
  href: string;
}

export function edgarFullTextSearch(query: string, entity?: string | null): string {
  const params = new URLSearchParams({ q: `"${query}"` });
  if (entity) params.set('entityName', entity);
  // Spaces must be %20 rather than +: this is a hash fragment, and EDGAR
  // does not decode + inside one. Getting this wrong makes every link
  // silently return nothing.
  return `https://www.sec.gov/edgar/search/#/${params.toString().replace(/\+/g, '%20')}`;
}

export function edgarCompany(ticker: string): string {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker=${encodeURIComponent(
    ticker,
  )}&type=10-&dateb=&owner=include&count=40`;
}

export function scholarSearch(query: string): string {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;
}

/** Ordered best-first. A stored URL always wins when one exists. */
export function sourceLinks(row: LedgerRow): SourceLink[] {
  const out: SourceLink[] = [];
  if (row.source_url) out.push({ label: 'Source', href: row.source_url });

  if (row.source_type === 'peer_reviewed') {
    out.push({
      label: 'Search Scholar',
      href: scholarSearch(`${row.company_name} ${row.source_name ?? ''}`.trim()),
    });
  }

  if (row.company_is_public && row.company_ticker) {
    out.push({ label: 'EDGAR filings', href: edgarCompany(row.company_ticker) });
    out.push({ label: 'EDGAR full text', href: edgarFullTextSearch(searchPhrase(row), row.company_name) });
  }
  return out;
}

/** Full-text search wants a short distinctive phrase; a whole headline
 *  returns nothing. */
export function searchPhrase(row: LedgerRow): string {
  const stop = new Set([
    'the','a','an','of','and','to','in','on','for','with','at','by','from','is','are','was','were',
    'its','it','that','this','as','about','around','while','than','not','but','into','over','per',
    'reports','report','claims','claim','says','said',
  ]);
  return row.headline
    .toLowerCase()
    .replace(/[^a-z0-9$%. ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stop.has(w))
    .slice(0, 5)
    .join(' ')
    .trim();
}
