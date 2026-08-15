import { EMPTY_FILTERS, type ConditionKey, type Filters } from './filters';
import type { ClaimKind, EpistemicTag, MeasurementBasis } from './types';

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

   ── The selection lives here too ───────────────────────────────────

   Filters used to sit in a useState in App. That made every interesting
   state of this application unshareable: "everyone whose gains were
   absorbed as slack, measured as hours freed" was reachable in two
   clicks and impossible to send to anyone. It is now in the URL, which
   also means the browser back button steps back through selections
   rather than jumping out of the view entirely.

   Only non-default values are written, so a clean view keeps a clean
   URL and the hash stays readable by a human.
   =================================================================== */

export type ViewName =
  | 'flow'
  | 'patterns'
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
  /** The selection in force, shared by every view. */
  filters: Filters;
  /** Companies pinned to the comparison tray. */
  pinned: string[];
  /**
   * The flow node the reader has committed to, as a node id.
   *
   * In the URL rather than in a useState for the same reason the
   * filters are: a focused diagram is a state worth sending to
   * someone, and it must survive a reload and step back with the
   * browser's back button like every other selection does.
   */
  focus: string | null;
}

export const HOME: Route = {
  view: 'flow',
  id: null,
  context: null,
  filters: EMPTY_FILTERS,
  pinned: [],
  focus: null,
};

const WITH_ID = new Set<ViewName>(['company', 'finding']);
const KNOWN = new Set<ViewName>([
  'flow', 'patterns', 'findings', 'finding', 'companies', 'company', 'destinations',
  'conditions', 'transfers', 'ledger', 'queue', 'submit', 'method',
]);

/** Up to four, because five stacked bars stop being comparable. */
export const MAX_PINNED = 4;

const list = (v: string | null): string[] =>
  (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const nums = (v: string | null): number[] =>
  list(v).map(Number).filter((n) => Number.isFinite(n));

export function parseFilters(q: URLSearchParams): Filters {
  return {
    search: q.get('q') ?? '',
    kinds: list(q.get('kind')) as ClaimKind[],
    bases: list(q.get('basis')) as MeasurementBasis[],
    destinations: nums(q.get('dest')),
    tags: list(q.get('tag')) as EpistemicTag[],
    tiers: nums(q.get('tier')),
    groups: list(q.get('group')),
    companies: list(q.get('co')),
    sectors: list(q.get('sector')),
    conditionsMet: list(q.get('cond')) as ConditionKey[],
    conditionCounts: nums(q.get('condn')).filter((n) => n >= 0 && n <= 3),
    counterpartyOnly: q.get('cp') === '1',
    conflictOnly: q.get('conflict') === '1',
    unverifiedOnly: q.get('unverified') === '1',
    dollarsOnly: q.get('dollars') === '1',
    // `from` is already the breadcrumb, so the dates are after/before.
    from: q.get('after') ?? null,
    to: q.get('before') ?? null,
  };
}

export function serializeFilters(f: Filters, q: URLSearchParams): void {
  if (f.search.trim()) q.set('q', f.search.trim());
  if (f.kinds.length) q.set('kind', f.kinds.join(','));
  if (f.bases.length) q.set('basis', f.bases.join(','));
  if (f.destinations.length) q.set('dest', f.destinations.join(','));
  if (f.tags.length) q.set('tag', f.tags.join(','));
  if (f.tiers.length) q.set('tier', f.tiers.join(','));
  if (f.groups.length) q.set('group', f.groups.join(','));
  if (f.companies.length) q.set('co', f.companies.join(','));
  if (f.sectors.length) q.set('sector', f.sectors.join(','));
  if (f.conditionsMet.length) q.set('cond', f.conditionsMet.join(','));
  if (f.conditionCounts.length) q.set('condn', f.conditionCounts.join(','));
  if (f.counterpartyOnly) q.set('cp', '1');
  if (f.conflictOnly) q.set('conflict', '1');
  if (f.unverifiedOnly) q.set('unverified', '1');
  if (f.dollarsOnly) q.set('dollars', '1');
  if (f.from) q.set('after', f.from);
  if (f.to) q.set('before', f.to);
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  if (!raw) return HOME;

  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const view = parts[0] as ViewName;

  if (!KNOWN.has(view)) return HOME;

  const q = new URLSearchParams(query ?? '');
  const filters = parseFilters(q);
  const pinned = list(q.get('pin')).slice(0, MAX_PINNED);
  const context = q.get('from') ?? null;
  const focus = q.get('focus') || null;

  const id = WITH_ID.has(view) ? (parts[1] ?? null) : null;
  // A company route with no slug is meaningless; send it to the index
  // rather than rendering an empty page.
  if (view === 'company' && !id) return { view: 'companies', id: null, context: null, filters, pinned, focus: null };
  // The findings page's written analysis now lives under the diagram.
  // The old link still has to land somewhere sensible.
  if (view === 'findings') return { view: 'flow', id: null, context, filters, pinned, focus };

  return { view, id, context, filters, pinned, focus };
}

export function toHash(route: Route): string {
  const parts = ['#', route.view];
  if (route.id) parts.push(encodeURIComponent(route.id));
  const base = parts.join('/');

  const q = new URLSearchParams();
  if (route.context) q.set('from', route.context);
  serializeFilters(route.filters, q);
  if (route.pinned.length) q.set('pin', route.pinned.slice(0, MAX_PINNED).join(','));
  // Only meaningful on the diagram; carrying it onto a company page
  // would leave a dead parameter in every link from there on.
  if (route.focus && route.view === 'flow') q.set('focus', route.focus);

  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

export function navigate(route: Route): void {
  const next = toHash(route);
  if (window.location.hash !== next) window.location.hash = next;
  else window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function companyRoute(
  slug: string,
  context: string | null,
  filters: Filters,
  pinned: string[],
): Route {
  return { view: 'company', id: slug, context: context ?? null, filters, pinned, focus: null };
}

/** Toggle a company in and out of the comparison tray, capped. */
export function togglePinned(pinned: string[], slug: string): string[] {
  if (pinned.includes(slug)) return pinned.filter((s) => s !== slug);
  if (pinned.length >= MAX_PINNED) return pinned;
  return [...pinned, slug];
}
