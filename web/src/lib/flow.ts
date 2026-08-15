import type { LedgerRow, MeasurementBasis } from './types';
import { basis, destination, DESTINATION_ORDER } from './labels';

/* ===================================================================
   THE FLOW

   One claimed dollar, followed from the company that claimed it to
   whether it can be found in a filing.

     company → what was measured → where it landed → traced or not

   This is the reconciliation bar unrolled. The bar puts one claim's
   traced and untraced portions side by side; this puts all of them
   side by side at once, which is the only way to see that six
   companies are stuck for the same reason.

   Three rules keep it honest, and all three are enforced here rather
   than in the component:

   1. Only `gain_claim` rows enter, the same rule `totals()` applies.
      A market-cap loss and an acquisition price are not claimed gains,
      and letting them set the width of the pipe would make the
      headline meaningless.

   2. A claim with no dollar figure has zero width and would simply
      vanish. Silently dropping rows from a diagram about missing
      numbers would be its own small lie, so they are counted and
      returned for the caller to state.

   3. Destinations keep their ladder order. The rank is distance from
      profit, so vertical position has to carry it; d3-sankey would
      otherwise reorder the column to minimise crossings and quietly
      destroy the encoding.
   =================================================================== */

export type FlowColumn = 'company' | 'basis' | 'destination' | 'outcome';

export interface FlowNode {
  /** Stable id, namespaced by column: `co:ibm`, `dest:1`, `out:traced`. */
  id: string;
  column: FlowColumn;
  label: string;
  /** Total value passing through, in USD. */
  value: number;
  /** Destination rank, when this node is a destination. Drives ordering. */
  rank?: number;
  /** Company slug, when this node is one company, for click-through. */
  slug?: string;
  /** Measurement basis key, when this node is one basis. */
  basisKey?: MeasurementBasis;
  /** True for the aggregated "N other companies" node. */
  aggregate?: boolean;
  /** Every company folded into the aggregate node, so a click on it
   *  filters to exactly those rather than doing nothing. */
  slugs?: string[];
  /** The traced/untraced terminals, which carry the hatch. */
  traced?: boolean;
}

export interface FlowLink {
  source: string;
  target: string;
  value: number;
  /** Rows behind this link, so a click can filter to exactly them. */
  refs: string[];
}

export interface FlowModel {
  nodes: FlowNode[];
  links: FlowLink[];
  claimedUsd: number;
  tracedUsd: number;
  untracedUsd: number;
  /** Gain claims carrying no dollar figure: real rows, no width. */
  gainsWithoutAmount: number;
  /** Rows excluded because they are not gain claims. */
  nonGainRows: number;
  /** Companies folded into the aggregate node. */
  companiesFolded: number;
}

/** Hard ceiling on named lanes, whatever the height allows. Past this
 *  the column stops being a ranking and starts being a wall. */
export const MAX_NAMED_COMPANIES = 10;

/**
 * Share of claimed dollars the named lanes should account for.
 *
 * A count threshold was the wrong instrument. It fired at twelve
 * companies, and the live ledger has about ten carrying a dollar
 * figure, so it never fired at all: a company claiming $50M got the
 * same lane, the same label and the same two lines of type as one
 * claiming $4.26B. Naming companies until they account for most of the
 * money is the question a reader actually has — who is most of this? —
 * and it answers with however many companies that takes.
 */
export const NAMED_VALUE_SHARE = 0.85;

/**
 * The smallest lane worth naming, as a fraction of the total.
 *
 * Below this a lane is thinner than its own label, so the label has to
 * be positioned away from the thing it names and the diagram starts
 * lying about where the money is.
 */
export const MIN_LANE_SHARE = 0.015;

const ORDER_INDEX = new Map(DESTINATION_ORDER.map((rank, i) => [rank, i]));

/** Sort key for a node within its column. Exported because the layout
 *  has to apply the same order and it must not drift from this file. */
export function columnOrder(node: FlowNode): number {
  if (node.column === 'destination') return ORDER_INDEX.get(node.rank ?? 0) ?? 99;
  // Companies rank by size, largest at the top, with the folded lump
  // last. Left unsorted, d3-sankey kept insertion order — which is the
  // order rows happened to arrive in — so the aggregate node sat above
  // every named company and the largest single claimant sat at the
  // bottom. Size and position disagreed, and position wins that
  // argument every time in a diagram whose whole subject is magnitude.
  if (node.column === 'company') return node.aggregate ? Infinity : -(node.value ?? 0);
  // Bases rank by size too. Nothing is encoded by their order, so the
  // only job left is to keep the thick ribbons from crossing the thin
  // ones more than they have to.
  if (node.column === 'basis') return -(node.value ?? 0);
  // Untraced above traced, mirroring the ladder beside it: the
  // destinations furthest from profit sit at the top and are the ones
  // that end up untraceable, while "kept as margin" sits at the bottom
  // and is where nearly all the traced money comes from. Ordering it
  // the other way round is defensible on paper and produces a single
  // enormous crossing on screen, which reads as noise rather than
  // as the two clean streams it actually is.
  if (node.column === 'outcome') return node.traced ? 1 : 0;
  return 0;
}

/**
 * Which companies get their own lane.
 *
 * Three rules, applied in order, all of them about legibility rather
 * than importance:
 *
 *   1. Take companies largest-first until they account for
 *      `NAMED_VALUE_SHARE` of the claimed total. That is the answer to
 *      "who is most of this money", which is the question the column
 *      exists to answer.
 *   2. Never name more than `maxNamed`, which the caller derives from
 *      the height actually available. A lane the reader cannot label
 *      is not a lane.
 *   3. Never name a company whose lane would be thinner than
 *      `MIN_LANE_SHARE`, even if rule 1 has not been satisfied yet.
 *      A hairline with a two-line label attached is worse than being
 *      inside the lump, because it claims a precision the pixel does
 *      not have.
 *
 * Folding one company into a node called "1 other company" is pure
 * loss: same clutter, less information, and a lump that is not a lump.
 * So a fold of one is undone.
 */
export function namedCompanies(
  ranked: Array<[string, { name: string; total: number }]>,
  maxNamed: number,
): Set<string> {
  const total = ranked.reduce((sum, [, c]) => sum + c.total, 0);
  if (total <= 0) return new Set(ranked.map(([slug]) => slug));

  const named = new Set<string>();
  let running = 0;

  for (const [slug, co] of ranked) {
    if (named.size >= maxNamed) break;
    if (co.total / total < MIN_LANE_SHARE) break;
    named.add(slug);
    running += co.total;
    if (running / total >= NAMED_VALUE_SHARE) break;
  }

  // A lump of one is not a lump.
  if (ranked.length - named.size === 1) named.add(ranked[ranked.length - 1][0]);
  return named;
}

export function buildFlow(rows: LedgerRow[], maxNamed = MAX_NAMED_COMPANIES): FlowModel {
  const gains = rows.filter((r) => r.claim_kind === 'gain_claim');
  const nonGainRows = rows.length - gains.length;

  const withMoney = gains.filter((r) => (r.claimed_amount_usd ?? 0) > 0);
  const gainsWithoutAmount = gains.length - withMoney.length;

  // Which companies get their own node. The rest are one honest lump
  // rather than forty illegible slivers.
  const byCompany = new Map<string, { name: string; total: number }>();
  for (const r of withMoney) {
    const cur = byCompany.get(r.company_slug) ?? { name: r.company_name, total: 0 };
    cur.total += r.claimed_amount_usd ?? 0;
    byCompany.set(r.company_slug, cur);
  }
  const ranked = [...byCompany.entries()].sort(
    // Name as the tiebreak, so the same dataset always folds the same
    // companies and a screenshot diff means a layout change.
    (a, b) => b[1].total - a[1].total || a[1].name.localeCompare(b[1].name),
  );
  const named = namedCompanies(ranked, maxNamed);
  const companiesFolded = Math.max(0, ranked.length - named.size);

  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, FlowLink>();

  const foldedSlugs = ranked.filter(([slug]) => !named.has(slug)).map(([slug]) => slug);

  const addNode = (n: FlowNode) => {
    const cur = nodes.get(n.id);
    if (cur) cur.value += n.value;
    else nodes.set(n.id, { ...n });
  };

  const addLink = (source: string, target: string, value: number, ref: string) => {
    if (value <= 0) return;
    const key = `${source}|${target}`;
    const cur = links.get(key);
    if (cur) {
      cur.value += value;
      if (!cur.refs.includes(ref)) cur.refs.push(ref);
    } else {
      links.set(key, { source, target, value, refs: [ref] });
    }
  };

  let claimedUsd = 0;
  let tracedUsd = 0;

  for (const r of withMoney) {
    const claimed = r.claimed_amount_usd ?? 0;
    // Traced can never exceed claimed: a bar wider than its own scale
    // is a data error, not a finding.
    const traced = Math.max(0, Math.min(r.traceable_to_pl_usd ?? 0, claimed));
    const untraced = claimed - traced;

    claimedUsd += claimed;
    tracedUsd += traced;

    const isNamed = named.has(r.company_slug);
    const coId = isNamed ? `co:${r.company_slug}` : 'co:__other__';
    const basisId = `basis:${r.measurement_basis}`;
    const destId = `dest:${r.destination}`;

    addNode({
      id: coId,
      column: 'company',
      label: isNamed ? r.company_name : `${companiesFolded} other companies`,
      value: claimed,
      slug: isNamed ? r.company_slug : undefined,
      aggregate: !isNamed,
      slugs: isNamed ? undefined : foldedSlugs,
    });
    addNode({
      id: basisId,
      column: 'basis',
      label: basis(r.measurement_basis).name,
      value: claimed,
      basisKey: r.measurement_basis,
    });
    addNode({
      id: destId,
      column: 'destination',
      label: destination(r.destination).name,
      value: claimed,
      rank: r.destination,
    });

    addLink(coId, basisId, claimed, r.ref);
    addLink(basisId, destId, claimed, r.ref);

    if (traced > 0) {
      addNode({ id: 'out:traced', column: 'outcome', label: 'Traceable to a filing', value: traced, traced: true });
      addLink(destId, 'out:traced', traced, r.ref);
    }
    if (untraced > 0) {
      addNode({ id: 'out:untraced', column: 'outcome', label: 'Not traceable', value: untraced, traced: false });
      addLink(destId, 'out:untraced', untraced, r.ref);
    }
  }

  return {
    nodes: [...nodes.values()],
    links: [...links.values()],
    claimedUsd,
    tracedUsd,
    untracedUsd: claimedUsd - tracedUsd,
    gainsWithoutAmount,
    nonGainRows,
    companiesFolded,
  };
}

/**
 * What a click on a node should filter the app to.
 *
 * Returned as a patch rather than applied here, so the caller merges it
 * into whatever is already in force and the URL stays the one source of
 * truth for the selection.
 */
export interface FlowSelection {
  companies?: string[];
  bases?: MeasurementBasis[];
  destinations?: number[];
}

export function selectionForNode(node: FlowNode): FlowSelection | null {
  if (node.column === 'company') {
    if (node.slug) return { companies: [node.slug] };
    // The lump opens into exactly the companies inside it, which is
    // the only way a reader can find out who they were. Returning null
    // here made the largest node on the diagram the one node that did
    // nothing when clicked.
    return node.slugs?.length ? { companies: [...node.slugs] } : null;
  }
  if (node.column === 'basis') return node.basisKey ? { bases: [node.basisKey] } : null;
  if (node.column === 'destination') return { destinations: [node.rank ?? 0] };
  // The outcome column is a property of each row's arithmetic rather
  // than a coded field, so there is no filter that means "traced".
  return null;
}

/**
 * The diagram as a ladder: one rung per destination, in rank order,
 * each carrying what was claimed and how much of it reached a filing.
 *
 * Read off the model's own links rather than recomputed from the rows,
 * so the narrow-screen rendering and the diagram cannot disagree about
 * the same number.
 */
export interface LadderRung {
  rank: number;
  label: string;
  claimed: number;
  traced: number;
}

export function ladderRungs(model: FlowModel): LadderRung[] {
  const out: LadderRung[] = [];

  for (const rank of DESTINATION_ORDER) {
    const node = model.nodes.find((n) => n.column === 'destination' && n.rank === rank);
    if (!node) continue;

    const traced = model.links
      .filter((l) => l.source === node.id && l.target === 'out:traced')
      .reduce((sum, l) => sum + l.value, 0);

    out.push({ rank, label: destination(rank).name, claimed: node.value, traced });
  }

  return out;
}

/** Column headings, left to right. */
export const FLOW_COLUMNS: Array<{ column: FlowColumn; label: string }> = [
  { column: 'company', label: 'Who claimed it' },
  { column: 'basis', label: 'What was measured' },
  { column: 'destination', label: 'Where it landed' },
  { column: 'outcome', label: 'Found in a filing?' },
];
