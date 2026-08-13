import { describe, expect, it } from 'vitest';
import { edgarCompany, edgarFullTextSearch, searchPhrase, sourceLinks } from '../src/lib/sourceLinks';
import { row } from './fixtures';

describe('edgarFullTextSearch', () => {
  it('never emits a plus sign, which EDGAR does not decode inside a hash', () => {
    const url = edgarFullTextSearch('productivity savings', 'IBM');
    expect(url).not.toContain('+');
    expect(url).toContain('%20');
  });
  it('keeps the query phrase quoted', () => {
    expect(edgarFullTextSearch('operating margin')).toContain('%22operating%20margin%22');
  });
});

describe('searchPhrase', () => {
  it('drops stop words and keeps the distinctive terms', () => {
    const p = searchPhrase(row({ headline: 'IBM reports $3.5B of productivity savings in 2024' }));
    expect(p).not.toMatch(/\breports\b|\bof\b|\bin\b/);
    expect(p).toContain('ibm');
    expect(p).toContain('productivity');
  });
  it('caps the phrase so full-text search returns something', () => {
    const p = searchPhrase(row({ headline: 'one two three four five six seven eight nine ten' }));
    expect(p.split(' ')).toHaveLength(5);
  });
});

describe('sourceLinks', () => {
  it('puts a stored URL first when one exists', () => {
    const links = sourceLinks(row({ source_url: 'https://example.com/x' }));
    expect(links[0].label).toBe('Source');
  });
  it('offers EDGAR only for public filers with a ticker', () => {
    expect(sourceLinks(row({ company_is_public: false, company_ticker: null })).length).toBe(0);
    expect(sourceLinks(row()).some((l) => l.label === 'EDGAR filings')).toBe(true);
  });
  it('offers Scholar for peer-reviewed sources', () => {
    const links = sourceLinks(row({ source_type: 'peer_reviewed' }));
    expect(links.some((l) => l.label === 'Search Scholar')).toBe(true);
  });
  it('builds an EDGAR company URL from the ticker', () => {
    expect(edgarCompany('IBM')).toContain('ticker=IBM');
  });
});
