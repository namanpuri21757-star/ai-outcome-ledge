import { describe, expect, it } from 'vitest';
import {
  HOME, MAX_PINNED, companyRoute, parseHash, toHash, togglePinned, type Route,
} from '../src/lib/route';
import { EMPTY_FILTERS, type Filters } from '../src/lib/filters';

/** A route with the boring parts filled in, so each test states only
 *  what it is about. */
const route = (patch: Partial<Route> = {}): Route => ({
  view: 'flow',
  id: null,
  context: null,
  filters: EMPTY_FILTERS,
  pinned: [],
  ...patch,
});

const filters = (patch: Partial<Filters> = {}): Filters => ({ ...EMPTY_FILTERS, ...patch });

describe('parseHash', () => {
  it('treats an empty hash as the flow home', () => {
    expect(parseHash('')).toEqual(HOME);
    expect(parseHash('#')).toEqual(HOME);
    expect(parseHash('#/')).toEqual(HOME);
  });

  it('parses a plain view', () => {
    expect(parseHash('#/ledger')).toEqual(route({ view: 'ledger' }));
  });

  it('parses the new pattern grid', () => {
    expect(parseHash('#/patterns').view).toBe('patterns');
  });

  it('parses a company slug', () => {
    expect(parseHash('#/company/ibm')).toEqual(route({ view: 'company', id: 'ibm' }));
  });

  it('carries the context that says where the reader came from', () => {
    expect(parseHash('#/company/ibm?from=absorbed%20as%20slack')).toEqual(
      route({ view: 'company', id: 'ibm', context: 'absorbed as slack' }),
    );
  });

  it('decodes a slug containing a hyphen or encoded characters', () => {
    expect(parseHash('#/company/mass-general-brigham').id).toBe('mass-general-brigham');
    expect(parseHash('#/company/current%2Dcrete').id).toBe('current-crete');
  });

  it('sends an unknown view home rather than rendering nothing', () => {
    expect(parseHash('#/nonsense')).toEqual(HOME);
  });

  it('sends a company route with no slug to the index rather than an empty page', () => {
    expect(parseHash('#/company')).toEqual(route({ view: 'companies' }));
  });

  it('ignores an id on a view that does not take one', () => {
    expect(parseHash('#/ledger/ibm').id).toBeNull();
  });

  it('lands the retired findings link on the flow page that absorbed it', () => {
    expect(parseHash('#/findings').view).toBe('flow');
  });

  it('keeps the findings drill-down working', () => {
    expect(parseHash('#/finding/who-converted')).toEqual(
      route({ view: 'finding', id: 'who-converted' }),
    );
  });
});

describe('the selection travels in the URL', () => {
  it('reads destinations, bases and companies', () => {
    const r = parseHash('#/patterns?dest=1,5&basis=net_pl,gross_capacity&co=ibm,klarna');
    expect(r.filters.destinations).toEqual([1, 5]);
    expect(r.filters.bases).toEqual(['net_pl', 'gross_capacity']);
    expect(r.filters.companies).toEqual(['ibm', 'klarna']);
  });

  it('reads the boolean narrowings', () => {
    const r = parseHash('#/ledger?cp=1&conflict=1&unverified=1&dollars=1');
    expect(r.filters.counterpartyOnly).toBe(true);
    expect(r.filters.conflictOnly).toBe(true);
    expect(r.filters.unverifiedOnly).toBe(true);
    expect(r.filters.dollarsOnly).toBe(true);
  });

  it('leaves booleans off when absent rather than guessing', () => {
    expect(parseHash('#/ledger').filters.counterpartyOnly).toBe(false);
  });

  it('keeps the date window clear of the breadcrumb, which also uses "from"', () => {
    const r = parseHash('#/ledger?after=2025-01-01&before=2025-12-31&from=who%20paid');
    expect(r.filters.from).toBe('2025-01-01');
    expect(r.filters.to).toBe('2025-12-31');
    expect(r.context).toBe('who paid');
  });

  it('reads a search term with spaces', () => {
    expect(parseHash('#/ledger?q=customer+service').filters.search).toBe('customer service');
  });

  it('discards non-numeric ranks rather than producing NaN', () => {
    expect(parseHash('#/patterns?dest=1,abc,5').filters.destinations).toEqual([1, 5]);
  });

  it('ignores empty entries from a trailing comma', () => {
    expect(parseHash('#/patterns?co=ibm,,').filters.companies).toEqual(['ibm']);
  });
});

describe('toHash', () => {
  it('round-trips a company route with context', () => {
    const r = companyRoute('ibm', 'kept as margin', EMPTY_FILTERS, []);
    expect(parseHash(toHash(r))).toEqual(r);
  });

  it('round-trips every simple view', () => {
    for (const view of ['flow', 'patterns', 'companies', 'ledger', 'method', 'transfers'] as const) {
      expect(parseHash(toHash(route({ view }))).view).toBe(view);
    }
  });

  it('encodes a context containing spaces and punctuation', () => {
    const h = toHash(companyRoute('ibm', 'who paid, and why?', EMPTY_FILTERS, []));
    expect(h).not.toMatch(/ /);
    expect(parseHash(h).context).toBe('who paid, and why?');
  });

  it('omits the query string entirely when nothing is selected', () => {
    expect(toHash(companyRoute('ibm', null, EMPTY_FILTERS, []))).toBe('#/company/ibm');
  });

  it('writes only what differs from the default, so a clean URL stays clean', () => {
    expect(toHash(route({ view: 'patterns', filters: filters({ destinations: [5] }) })))
      .toBe('#/patterns?dest=5');
  });

  it('round-trips a full selection', () => {
    const r = route({
      view: 'patterns',
      filters: filters({
        search: 'customer service',
        destinations: [1, 5],
        bases: ['net_pl'],
        companies: ['ibm'],
        groups: ['D'],
        tiers: [1, 2],
        counterpartyOnly: true,
        dollarsOnly: true,
        from: '2025-01-01',
        to: '2025-12-31',
      }),
      pinned: ['ibm', 'klarna'],
    });
    expect(parseHash(toHash(r))).toEqual(r);
  });

  it('carries pinned companies so a comparison is shareable', () => {
    const h = toHash(route({ pinned: ['ibm', 'klarna'] }));
    expect(h).toContain('pin=ibm%2Cklarna');
    expect(parseHash(h).pinned).toEqual(['ibm', 'klarna']);
  });

  it('never emits more pins than the tray can hold', () => {
    const r = route({ pinned: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(parseHash(toHash(r)).pinned).toHaveLength(MAX_PINNED);
  });
});

describe('togglePinned', () => {
  it('adds and removes', () => {
    expect(togglePinned([], 'ibm')).toEqual(['ibm']);
    expect(togglePinned(['ibm'], 'ibm')).toEqual([]);
  });

  it('stops at the cap instead of silently dropping the oldest', () => {
    const full = ['a', 'b', 'c', 'd'];
    expect(togglePinned(full, 'e')).toEqual(full);
  });

  it('still un-pins when full, so the tray is never stuck', () => {
    expect(togglePinned(['a', 'b', 'c', 'd'], 'c')).toEqual(['a', 'b', 'd']);
  });
});
