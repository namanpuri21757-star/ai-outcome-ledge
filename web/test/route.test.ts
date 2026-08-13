import { describe, expect, it } from 'vitest';
import { HOME, companyRoute, parseHash, toHash } from '../src/lib/route';

describe('parseHash', () => {
  it('treats an empty hash as the findings home', () => {
    expect(parseHash('')).toEqual(HOME);
    expect(parseHash('#')).toEqual(HOME);
    expect(parseHash('#/')).toEqual(HOME);
  });

  it('parses a plain view', () => {
    expect(parseHash('#/ledger')).toEqual({ view: 'ledger', id: null, context: null });
  });

  it('parses a company slug', () => {
    expect(parseHash('#/company/ibm')).toEqual({ view: 'company', id: 'ibm', context: null });
  });

  it('carries the context that says where the reader came from', () => {
    expect(parseHash('#/company/ibm?from=absorbed%20as%20slack')).toEqual({
      view: 'company', id: 'ibm', context: 'absorbed as slack',
    });
  });

  it('decodes a slug containing a hyphen or encoded characters', () => {
    expect(parseHash('#/company/mass-general-brigham').id).toBe('mass-general-brigham');
    expect(parseHash('#/company/current%2Dcrete').id).toBe('current-crete');
  });

  it('sends an unknown view home rather than rendering nothing', () => {
    expect(parseHash('#/nonsense')).toEqual(HOME);
  });

  it('sends a company route with no slug to the index rather than an empty page', () => {
    expect(parseHash('#/company')).toEqual({ view: 'companies', id: null, context: null });
  });

  it('ignores an id on a view that does not take one', () => {
    expect(parseHash('#/ledger/ibm').id).toBeNull();
  });
});

describe('toHash', () => {
  it('round-trips a company route with context', () => {
    const r = companyRoute('ibm', 'kept as margin');
    expect(parseHash(toHash(r))).toEqual(r);
  });

  it('round-trips every simple view', () => {
    for (const view of ['findings', 'companies', 'ledger', 'method', 'transfers'] as const) {
      expect(parseHash(toHash({ view, id: null, context: null })).view).toBe(view);
    }
  });

  it('encodes a context containing spaces and punctuation', () => {
    const h = toHash(companyRoute('ibm', 'who paid, and why?'));
    expect(h).not.toMatch(/ /);
    expect(parseHash(h).context).toBe('who paid, and why?');
  });

  it('omits the query string when there is no context', () => {
    expect(toHash(companyRoute('ibm'))).toBe('#/company/ibm');
  });
});
