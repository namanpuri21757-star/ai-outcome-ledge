import { EMPTY_FILTERS, type Filters } from './filters';
import type { ClaimKind, MeasurementBasis, VerificationStatus } from './types';

/* ===================================================================
   Six routes. Everything a reader can be looking at is one of them,
   and every state of the ledger is a link.

     (no hash)             the landing page — what this is, in seconds
     #/                    the ledger — the finding, and every row
     #/claim/<ref>         one claim, fully unpacked
     #/company/<slug>      one company's whole record
     #/method              how a row is coded, generated from labels.ts
     #/maintenance         collector health, the checking queue, submit

   ── Why the landing page is the empty hash ────────────────────────

   `#/` was the ledger before the landing page existed and still is:
   every link the app writes, every shared URL, every bookmark points
   there and must keep resolving there. So the one address left over is
   the bare root — a visitor who types the domain and nothing else. That
   is exactly the visitor the landing page is for. `#/home` names the
   same page for anyone who needs to link to it.

   ── Filter scope is enforced here ─────────────────────────────────

   Filter parameters are read and written **only** on the ledger route.
   That is not a convention, it is the mechanism: `toHash` refuses to
   serialise them anywhere else and `parseHash` returns EMPTY_FILTERS for
   any other view, so a claim page or a company page cannot be handed a
   selection even by hand-editing the URL.

   The previous build carried the selection into every view "because a
   filter that survives one click and not the next is worse than no
   filter". The result was a company page reporting "6 gain claims worth
   $4.26B" beside a sidebar reading "10 rows · $4.15B" — two scopes, one
   screen, no way to tell which applied. Going back still restores the
   selection, because the previous entry in the history still carries it.
   =================================================================== */

export type ViewName = 'home' | 'ledger' | 'claim' | 'company' | 'method' | 'maintenance';

const KNOWN: ViewName[] = ['home', 'ledger', 'claim', 'company', 'method', 'maintenance'];

/** Views that take an identifier after the view name. */
const WITH_ID: ViewName[] = ['claim', 'company'];

/** The one view that owns the selection. */
export const FILTERED_VIEW: ViewName = 'ledger';

export interface Route {
  view: ViewName;
  id: string | null;
  filters: Filters;
}

/** Where an unreadable hash lands, and what `#/` means. */
export const LEDGER: Route = { view: 'ledger', id: null, filters: EMPTY_FILTERS };

/** The bare root. A visitor who has not been sent anywhere in particular. */
export const LANDING: Route = { view: 'home', id: null, filters: EMPTY_FILTERS };

const list = (raw: string | null): string[] =>
  (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const nums = (raw: string | null): number[] =>
  list(raw).map(Number).filter((n) => Number.isFinite(n));

export function parseFilters(q: URLSearchParams): Filters {
  return {
    search: q.get('q') ?? '',
    kinds: list(q.get('kind')) as ClaimKind[],
    bases: list(q.get('basis')) as MeasurementBasis[],
    destinations: nums(q.get('dest')),
    verification: list(q.get('check')) as VerificationStatus[],
    groups: list(q.get('type')),
    companies: list(q.get('co')),
    dollarsOnly: q.get('dollars') === '1',
  };
}

/** Only non-default values are written, so a clean view keeps a clean URL. */
export function serializeFilters(f: Filters, q: URLSearchParams): void {
  if (f.search.trim()) q.set('q', f.search.trim());
  if (f.kinds.length) q.set('kind', f.kinds.join(','));
  if (f.bases.length) q.set('basis', f.bases.join(','));
  if (f.destinations.length) q.set('dest', f.destinations.join(','));
  if (f.verification.length) q.set('check', f.verification.join(','));
  if (f.groups.length) q.set('type', f.groups.join(','));
  if (f.companies.length) q.set('co', f.companies.join(','));
  if (f.dollarsOnly) q.set('dollars', '1');
}

export function parseHash(hash: string): Route {
  // `#/` carries a slash and the bare root does not, and that one
  // character is the whole distinction between the ledger and the
  // landing page. Read it before the slash is stripped.
  const isBareRoot = hash === '' || hash === '#';
  const raw = (hash ?? '').replace(/^#\/?/, '');
  if (!raw) return isBareRoot ? LANDING : LEDGER;

  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  // `#/?dest=5` has a query but no path segment, and it is the shape
  // every shared link to a filtered ledger takes.
  const view = (parts[0] ?? 'ledger') as ViewName;

  if (!KNOWN.includes(view)) return LEDGER;

  const id = WITH_ID.includes(view) ? (parts[1] ?? null) : null;
  // A drill-down with no identifier is a link that lost its subject.
  if (WITH_ID.includes(view) && !id) return LEDGER;

  return {
    view,
    id,
    filters: view === FILTERED_VIEW ? parseFilters(new URLSearchParams(query)) : EMPTY_FILTERS,
  };
}

export function toHash(route: Route): string {
  const q = new URLSearchParams();
  if (route.view === FILTERED_VIEW) serializeFilters(route.filters, q);

  const segments: string[] = [route.view];
  if (WITH_ID.includes(route.view) && route.id) segments.push(encodeURIComponent(route.id));

  // The ledger is `#/` rather than `#/ledger`, because that is the URL
  // every link written before the landing page existed already uses.
  const path = route.view === 'ledger' ? '' : segments.join('/');
  const qs = q.toString();
  return `#/${path}${qs ? '?' + qs : ''}`;
}

export function navigate(route: Route): void {
  const next = toHash(route);
  if (window.location.hash === next) {
    // Same hash means no `hashchange`, and the view would not update.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = next;
}

export const ledgerRoute = (filters: Filters): Route => ({ view: 'ledger', id: null, filters });
export const claimRoute = (ref: string): Route => ({ view: 'claim', id: ref, filters: EMPTY_FILTERS });
export const companyRoute = (slug: string): Route => ({
  view: 'company',
  id: slug,
  filters: EMPTY_FILTERS,
});
