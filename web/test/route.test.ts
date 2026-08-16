import { describe, expect, it } from 'vitest';
import {
  claimRoute, companyRoute, FILTERED_VIEW, LANDING, LEDGER, ledgerRoute, parseFilters, parseHash,
  serializeFilters, toHash,
} from '../src/lib/route';
import { EMPTY_FILTERS, type Filters } from '../src/lib/filters';

const f = (patch: Partial<Filters> = {}): Filters => ({ ...EMPTY_FILTERS, ...patch });

describe('parseHash', () => {
  it('lands on the landing page at the bare root, and only there', () => {
    // The distinction is one character. `#/` is the ledger because every
    // link this app has ever written points at it; the bare root is the
    // address nobody was sent to, which is who the landing page is for.
    expect(parseHash('')).toEqual(LANDING);
    expect(parseHash('#')).toEqual(LANDING);
    expect(parseHash('#/')).toEqual(LEDGER);
  });

  it('names the landing page for anyone who has to link to it', () => {
    expect(parseHash('#/home')).toEqual(LANDING);
    expect(toHash(LANDING)).toBe('#/home');
  });

  it('carries no filter onto the landing page, even by hand', () => {
    expect(parseHash('#/home?dest=5&q=ibm').filters).toEqual(EMPTY_FILTERS);
    expect(toHash({ ...LANDING, filters: f({ destinations: [5] }) })).toBe('#/home');
  });

  it('lands on the ledger for a view that no longer exists', () => {
    // Every deleted view, by its old name. None may resolve.
    for (const dead of ['flow', 'patterns', 'companies', 'destinations', 'conditions',
                        'transfers', 'queue', 'submit', 'finding', 'findings']) {
      expect(parseHash(`#/${dead}`).view, dead).toBe('ledger');
    }
  });

  it('reads a claim by its reference', () => {
    const r = parseHash('#/claim/ibm-productivity-3-5b-2024');
    expect(r.view).toBe('claim');
    expect(r.id).toBe('ibm-productivity-3-5b-2024');
  });

  it('reads a company by its slug', () => {
    expect(parseHash('#/company/wtw')).toMatchObject({ view: 'company', id: 'wtw' });
  });

  it('sends a drill-down with no identifier home rather than rendering nothing', () => {
    expect(parseHash('#/company').view).toBe('ledger');
    expect(parseHash('#/claim').view).toBe('ledger');
  });

  it('decodes an identifier that was encoded, slash and all', () => {
    expect(parseHash('#/company/' + encodeURIComponent('a b/c')).id).toBe('a b/c');
  });

  it('reads the ledger when the hash is only a query — the shape of a shared link', () => {
    const r = parseHash('#/?dest=5');
    expect(r.view).toBe('ledger');
    expect(r.filters.destinations).toEqual([5]);
  });
});

describe('filter scope is enforced by the router', () => {
  it('reads filters on the ledger', () => {
    const r = parseHash('#/?dest=5&kind=gain_claim&q=klarna');
    expect(r.filters.destinations).toEqual([5]);
    expect(r.filters.kinds).toEqual(['gain_claim']);
    expect(r.filters.search).toBe('klarna');
  });

  it('refuses to read filters on a claim page, even when the URL carries them', () => {
    const r = parseHash('#/claim/some-ref?dest=5&q=klarna&dollars=1');
    expect(r.filters).toEqual(EMPTY_FILTERS);
  });

  it('refuses to read filters on a company page — the defect that showed two scopes at once', () => {
    const r = parseHash('#/company/ibm?dest=1&kind=gain_claim');
    expect(r.filters).toEqual(EMPTY_FILTERS);
  });

  it('refuses to read filters on method and maintenance', () => {
    expect(parseHash('#/method?dest=5').filters).toEqual(EMPTY_FILTERS);
    expect(parseHash('#/maintenance?dest=5').filters).toEqual(EMPTY_FILTERS);
  });

  it('refuses to write filters anywhere but the ledger', () => {
    const dirty = f({ destinations: [5], search: 'x' });
    expect(toHash({ view: 'company', id: 'ibm', filters: dirty })).toBe('#/company/ibm');
    expect(toHash({ view: 'claim', id: 'r', filters: dirty })).toBe('#/claim/r');
    expect(toHash({ view: 'method', id: null, filters: dirty })).toBe('#/method');
  });

  it('names the one view that owns the selection', () => {
    expect(FILTERED_VIEW).toBe('ledger');
  });

  it('drops the filter when a drill-down route is built', () => {
    expect(companyRoute('ibm').filters).toEqual(EMPTY_FILTERS);
    expect(claimRoute('ref-1').filters).toEqual(EMPTY_FILTERS);
  });
});

describe('toHash', () => {
  it('keeps a clean ledger URL clean', () => {
    expect(toHash(LEDGER)).toBe('#/');
    expect(toHash(ledgerRoute(EMPTY_FILTERS))).toBe('#/');
  });

  it('writes only non-default values', () => {
    expect(toHash(ledgerRoute(f({ dollarsOnly: true })))).toBe('#/?dollars=1');
    expect(toHash(ledgerRoute(f({ search: '  spaced  ' })))).toBe('#/?q=spaced');
  });

  it('round-trips every filter dimension', () => {
    const full = f({
      search: 'klarna savings',
      kinds: ['gain_claim', 'context'],
      bases: ['net_pl'],
      destinations: [1, 5],
      verification: ['disputed'],
      groups: ['D', 'F'],
      companies: ['ibm', 'wtw'],
      dollarsOnly: true,
    });
    expect(parseHash(toHash(ledgerRoute(full))).filters).toEqual(full);
  });

  it('encodes an identifier containing a slash', () => {
    expect(toHash(claimRoute('a/b'))).toBe('#/claim/a%2Fb');
    expect(parseHash(toHash(claimRoute('a/b'))).id).toBe('a/b');
  });
});

describe('parseFilters', () => {
  it('drops a non-numeric destination rather than producing NaN', () => {
    expect(parseFilters(new URLSearchParams('dest=5,abc,1')).destinations).toEqual([5, 1]);
  });

  it('ignores empty values in a list', () => {
    expect(parseFilters(new URLSearchParams('kind=,,gain_claim,')).kinds).toEqual(['gain_claim']);
  });

  it('treats an empty search parameter as no search', () => {
    expect(parseFilters(new URLSearchParams('q=')).search).toBe('');
  });

  it('reads dollars only when it is exactly 1', () => {
    expect(parseFilters(new URLSearchParams('dollars=1')).dollarsOnly).toBe(true);
    expect(parseFilters(new URLSearchParams('dollars=true')).dollarsOnly).toBe(false);
  });
});

describe('serializeFilters', () => {
  it('writes nothing for a clean selection', () => {
    const q = new URLSearchParams();
    serializeFilters(EMPTY_FILTERS, q);
    expect(q.toString()).toBe('');
  });

  it('trims the search before writing it', () => {
    const q = new URLSearchParams();
    serializeFilters(f({ search: '  x  ' }), q);
    expect(q.get('q')).toBe('x');
  });
});
