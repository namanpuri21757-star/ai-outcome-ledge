/* ===================================================================
   ROUTING

   The old app kept the current view in a useState. That made a company
   page impossible to link to, impossible to bookmark, and impossible to
   return to with the browser back button — which is exactly what you
   reach for when a click drops you somewhere unexpected.

   Hash routing is used rather than the history API because the site is
   deployed as static assets. A hash route cannot 404 on a hard refresh
   no matter how the host is configured.

   `context` is the small but load-bearing piece: it carries where you
   came from, so arriving at a company page from the destinations view
   still says "absorbed as slack" at the top instead of dropping the
   frame you were reading in.
   =================================================================== */

export type ViewName =
  | 'findings'
  | 'finding'
  | 'companies'
  | 'company'
  | 'destinations'
  | 'conditions'
  | 'transfers'
  | 'ledger'
  | 'queue'
  | 'submit'
  | 'method';

export interface Route {
  view: ViewName;
  /** Company slug or finding id, depending on the view. */
  id: string | null;
  /** Human-readable breadcrumb of where the reader came from. */
  context: string | null;
}

export const HOME: Route = { view: 'findings', id: null, context: null };

const WITH_ID = new Set<ViewName>(['company', 'finding']);
const KNOWN = new Set<ViewName>([
  'findings', 'finding', 'companies', 'company', 'destinations',
  'conditions', 'transfers', 'ledger', 'queue', 'submit', 'method',
]);

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  if (!raw) return HOME;

  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const view = parts[0] as ViewName;

  if (!KNOWN.has(view)) return HOME;

  const id = WITH_ID.has(view) ? (parts[1] ?? null) : null;
  // A company route with no slug is meaningless; send it to the index
  // rather than rendering an empty page.
  if (view === 'company' && !id) return { view: 'companies', id: null, context: null };

  const context = query ? (new URLSearchParams(query).get('from') ?? null) : null;
  return { view, id, context };
}

export function toHash(route: Route): string {
  const parts = ['#', route.view];
  if (route.id) parts.push(encodeURIComponent(route.id));
  const base = parts.join('/');
  return route.context ? `${base}?from=${encodeURIComponent(route.context)}` : base;
}

export function navigate(route: Route): void {
  const next = toHash(route);
  if (window.location.hash !== next) window.location.hash = next;
  else window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function companyRoute(slug: string, context?: string | null): Route {
  return { view: 'company', id: slug, context: context ?? null };
}
