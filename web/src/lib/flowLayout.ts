/* ===================================================================
   FLOW LAYOUT ARITHMETIC

   Labels used to overlap because two quantities were set independently
   and never compared: the gap between nodes was a constant (15px) and
   the label attached to each node was two lines of type (about 30px).
   Whenever a lane was thin — which is exactly when a company is small,
   which is exactly the case the diagram most needs to keep readable —
   the two labels either side of it collided.

   Nothing here tunes that. The gap between nodes IS the height of a
   label, so two labels cannot touch however thin the lanes get, and
   the number of lanes is then whatever that gap allows in the height
   available. Overlap stops being a thing to check for and becomes a
   thing the arithmetic forbids.

   These numbers are duplicated nowhere. `.flow-node-name` and
   `.flow-node-value` in styles.css must resolve to NAME_SIZE and
   VALUE_SIZE; the test below asserts the block height they imply.
   =================================================================== */

/** Type ramp step `--t-sm`. The company name. */
export const NAME_SIZE = 14;
/** Type ramp step `--t-xs`. The figure under it. */
export const VALUE_SIZE = 12;
/** Leading applied to both lines. */
export const LINE_HEIGHT = 1.15;
/** Clear space above and below a label block, so two blocks that are
 *  exactly `LABEL_BLOCK` apart still read as separate. */
export const LABEL_BREATH = 6;

/**
 * The vertical space one two-line node label occupies.
 *
 * Derived rather than measured: measuring it would mean laying the
 * diagram out twice, and the ramp is fixed, so the answer is knowable
 * in advance.
 */
export const LABEL_BLOCK = Math.ceil((NAME_SIZE + VALUE_SIZE) * LINE_HEIGHT) + LABEL_BREATH;

/** A lane carrying money must be visible even when it is the smallest. */
export const MIN_NODE_H = 3;

/** Below this the diagram is not worth drawing. */
export const MIN_HEIGHT = 280;

/**
 * Above this it stops being a diagram and becomes a scroll.
 *
 * The whole argument of this page is that you can see the shape at
 * once. A diagram taller than the window cannot make that argument
 * however carefully its labels are spaced.
 */
export const MAX_HEIGHT = 720;

/**
 * How many lanes fit in a height without their labels touching.
 *
 *   n nodes need n × MIN_NODE_H + (n − 1) × padding
 */
export function lanesThatFit(height: number, padding = LABEL_BLOCK, minNode = MIN_NODE_H): number {
  if (!Number.isFinite(height) || height <= 0) return 0;
  return Math.max(1, Math.floor((height + padding) / (minNode + padding)));
}

/** The inverse: height needed to draw n lanes legibly. */
export function heightForLanes(n: number, padding = LABEL_BLOCK, minNode = MIN_NODE_H): number {
  if (n <= 0) return 0;
  return n * minNode + (n - 1) * padding;
}

export interface FlowPlan {
  /** Height to draw the diagram at, margins excluded. */
  height: number;
  /** Gap between nodes — always at least one label block. */
  nodePadding: number;
  /**
   * Companies that may keep their own lane. The caller passes this to
   * `buildFlow`, which may name fewer if the value-share rule bites
   * first, but never more.
   */
  maxNamed: number;
}

export interface FlowPlanInput {
  /** Companies carrying a dollar figure in the current selection. */
  companies: number;
  /** Distinct measurement bases present. */
  bases: number;
  /** Distinct destinations present. */
  destinations: number;
  /** Ceiling on named lanes from the model itself. */
  ceiling: number;
}

/**
 * Decide the diagram's height and how many companies it can name.
 *
 * The binding constraint is whichever column has the most nodes, not
 * the company column: eight measurement bases in a diagram naming
 * three companies still need eight labelled slots, and sizing to the
 * company column would collide them instead.
 */
export function planFlow({ companies, bases, destinations, ceiling }: FlowPlanInput): FlowPlan {
  const padding = LABEL_BLOCK;

  const affordable = lanesThatFit(MAX_HEIGHT, padding);
  const room = Math.min(ceiling, affordable);

  // Whether a lump exists at all decides how many lanes the column
  // needs, so it is settled first rather than inferred afterwards.
  // Inferring it was wrong at exactly one input — eleven companies
  // against a ceiling of ten — where the aggregate lane was drawn but
  // never deducted, and the planner reported it could name eleven.
  const fitsWhole = companies <= room;

  const maxNamed = fitsWhole ? companies : Math.max(1, Math.min(ceiling, affordable - 1));
  const companyLanes = fitsWhole ? companies : maxNamed + 1;

  const rows = Math.max(companyLanes, bases, destinations, 1);
  const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, heightForLanes(rows, padding)));

  return { height, nodePadding: padding, maxNamed: Math.max(1, maxNamed) };
}
