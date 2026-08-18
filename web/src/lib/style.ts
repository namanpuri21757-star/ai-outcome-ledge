/* ===================================================================
   THE STYLE PROOF — its vocabulary, its three records, and the
   geometry of the threshold sweep.

   This module exists so the proof page can be judged without a
   database, and so the parts of it that are arguable are arguable in
   one place rather than inside JSX.

   ── Why this vocabulary is not in labels.ts ───────────────────────

   `labels.ts` is the ledger's vocabulary and `MethodView` renders
   `glossary()` from it, so a term added there appears on the Method
   page. This page is a proof of a *different* product's vocabulary and
   is meant to be judged and then promoted or thrown away. Putting
   evidence tiers into the ledger's glossary would change a shipped
   screen to stage a proposal. If this page is promoted, this module
   folds into `labels.ts` and the definitions move to `define()`.

   ── The one rule this module enforces ─────────────────────────────

   A figure is a `Tiered` value or it does not exist. There is no bare
   number in this module and no way to render one on the page: every
   figure carries the tier it was learned at, and `TIERS` says what
   each tier is worth. That is the whole argument of the redesign,
   expressed as a type.
   =================================================================== */

/** How well a figure is known. Ordered best to worst. */
export type Tier = 'observed' | 'reported' | 'estimated' | 'asserted';

export const TIER_ORDER: Tier[] = ['observed', 'reported', 'estimated', 'asserted'];

/** Reversible, and never called a verdict. */
export type Status = 'dormant' | 'threshold_crossed' | 'contested' | 'contradicted';

/**
 * The distinction the thesis is most likely to be wrong about, so it is
 * a field rather than a sentence: long-tail *content* in a language
 * already served is a different claim from a long-tail *language*.
 */
export type Classification = 'content' | 'languages';

export interface TierMark {
  tier: Tier;
  /** The tickmark itself, set in mono. Defined in the legend, never alone. */
  mark: string;
  label: string;
  /** What the mark asserts, in the auditor's sense: what was done to check. */
  meaning: string;
}

/**
 * Audit tickmarks, not coloured pills.
 *
 * A tickmark in a workpaper is a promise about an action the preparer
 * took. These four are chosen to match the actions that actually
 * separate the tiers, and each is defined in the legend on the page —
 * an undefined mark is decoration.
 */
export const TIERS: TierMark[] = [
  {
    tier: 'observed',
    mark: '✓',
    label: 'Observed',
    meaning: 'Traced to a primary source the reader can open and check.',
  },
  {
    tier: 'reported',
    mark: '⊙',
    label: 'Reported',
    meaning: 'Confirmed only with the party who said it. Named inline, not independently checked.',
  },
  {
    tier: 'estimated',
    mark: '~',
    label: 'Estimated',
    meaning: 'Derived by this project from other figures. The formula is stated beside it.',
  },
  {
    tier: 'asserted',
    mark: '†',
    label: 'Asserted',
    meaning: 'The author’s judgment. No external support of any kind.',
  },
];

export const tierMark = (tier: Tier): TierMark => TIERS.find((t) => t.tier === tier)!;

export const STATUS_LABEL: Record<Status, string> = {
  dormant: 'Dormant',
  threshold_crossed: 'Threshold crossed',
  contested: 'Contested',
  contradicted: 'Contradicted',
};

/**
 * Two accents and no more. Green carries `threshold crossed`, the muted
 * audit red carries `contradicted`, and the two honest middle states are
 * ink on paper — which is the point: most of this record is unresolved,
 * and colour would be the wrong way to say so.
 */
export const STATUS_TONE: Record<Status, 'crossed' | 'against' | 'ink'> = {
  threshold_crossed: 'crossed',
  contradicted: 'against',
  dormant: 'ink',
  contested: 'ink',
};

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  content: 'Long-tail content',
  languages: 'Long-tail languages',
};

export const CLASSIFICATION_NOTE: Record<Classification, string> = {
  content:
    'A niche of thin content inside a language that is already well served. The cost collapse here is documented.',
  languages:
    'A niche defined by the language itself being under-served. This is the contested case, and the one the thesis needs.',
};

/**
 * A figure, with how well it is known.
 *
 * `value` is a string rather than a number on purpose: two of the three
 * cost figures in the seed record are ranges that were never
 * established, and the honest rendering of "not established" is those
 * words, not a zero and not a dash.
 */
export interface Tiered {
  value: string;
  tier: Tier;
  /** Who said it, or what it was derived from. Always present. */
  source: string;
  /** Only for `estimated`: how the figure was arrived at. */
  formula?: string;
  /** True when no figure exists at all, only a description of its absence. */
  unresolved?: boolean;
}

export interface EvidenceItem {
  /** Workpaper cross-reference, e.g. `A-1.2`. Ties the row to its support. */
  ref: string;
  text: string;
  tier: Tier;
  source: string;
}

export interface Niche {
  /** Lead-schedule reference. The row is cited by this everywhere. */
  ref: string;
  name: string;
  classification: Classification;
  status: Status;
  /** Why the status is what it is. Reversible, and dated when it changes. */
  statusReason: string;
  statusChanged: string;
  cost: Tiered;
  wtp: Tiered;
  evidence: EvidenceItem[];
  note: string;
}

/* -------------------------------------------------------------------
   The three records. Verbatim from the brief; nothing added, and where
   the brief gives no figure, none is invented.
   ------------------------------------------------------------------- */

export const NICHES: Niche[] = [
  {
    ref: 'A-1',
    name: 'YouTube creator back-catalog, dubbed to Hindi, Spanish and Portuguese',
    classification: 'content',
    status: 'threshold_crossed',
    statusReason:
      'Production cost sits an order of magnitude below the price buyers were paying, and the capability shipped to every eligible creator.',
    statusChanged: '2026-02',
    cost: {
      value: '$1–10 per finished minute',
      tier: 'reported',
      source: 'Vendor and operator figures; not independently checked.',
    },
    wtp: {
      value: '$50–200 per finished minute',
      tier: 'estimated',
      source: 'Studio dubbing list price, used as a proxy for what buyers would pay.',
      formula:
        'Willingness to pay is taken to be the incumbent studio price, on the reasoning that a buyer who paid it once would pay it again. The underlying $50–200 is reported; treating it as willingness to pay is this project’s inference, and it is the weakest link in this row.',
    },
    evidence: [
      {
        ref: 'A-1.1',
        text: 'YouTube auto-dub expanded to all eligible creators, 27 languages, February 2026.',
        tier: 'observed',
        source: 'Product announcement, dated and public.',
      },
      {
        ref: 'A-1.2',
        text: 'Creators using multi-language audio saw more than 25% of watch time come from non-primary languages.',
        tier: 'reported',
        source: 'YouTube’s own figure.',
      },
    ],
    note:
      'Activated but likely non-capturable. Auto-dub is free and on by default, so the surplus reaches the buyer without a vendor ever billing for it.',
  },
  {
    ref: 'B-2',
    name: 'OTT back-catalog dubbed into diaspora languages',
    classification: 'content',
    status: 'contested',
    statusReason:
      'The cost side has resolved and the demand side has not. Operators are running tests precisely because they do not know.',
    statusChanged: '2026-06',
    cost: {
      value: 'Falling, range not established',
      tier: 'estimated',
      source: 'Inferred from the same tooling as A-1; no operator has published a per-minute figure.',
      formula:
        'No arithmetic is offered. The direction is inferred from the same tooling that produced A-1’s range; the magnitude is not, and a range invented here would be the kind of number this project exists to catch.',
      unresolved: true,
    },
    wtp: {
      value: 'Not established',
      tier: 'asserted',
      source: 'No published figure, and no defensible proxy. The incumbent price does not transfer from A-1.',
      unresolved: true,
    },
    evidence: [
      {
        ref: 'B-2.1',
        text:
          'Operators reported testing AI-only dubs specifically to discover which languages drive watch time before committing.',
        tier: 'reported',
        source: 'Operator statements.',
      },
    ],
    note:
      'Cost side resolved, demand side unresolved. A test run to find out whether demand exists is evidence that it is not yet known.',
  },
  {
    ref: 'C-3',
    name: 'Public-health and government content in low-resource African languages',
    classification: 'languages',
    status: 'dormant',
    statusReason:
      'The quality gap is measured and large, and the human verification a low-resource language needs is scarcer than the one a high-resource language needs.',
    statusChanged: '2026-04',
    cost: {
      value: 'Unresolved',
      tier: 'asserted',
      source:
        'The author’s reading that the verification complement is scarcer, not cheaper. No figure supports this.',
      unresolved: true,
    },
    wtp: {
      value: 'Not established',
      tier: 'asserted',
      source: 'Buyers are public bodies with no published price for this work.',
      unresolved: true,
    },
    evidence: [
      {
        ref: 'C-3.1',
        text:
          'Same-benchmark performance gap of 22.9 to 56.1 points absolute between Afrikaans and Bambara.',
        tier: 'observed',
        source: 'Published benchmark, checkable.',
      },
      {
        ref: 'C-3.2',
        text: 'Google put $8M into African language and health technology.',
        tier: 'reported',
        source: 'Announced figure.',
      },
    ],
    note:
      'This is the case the thesis needs and the case the evidence least supports. The one observed figure on this row measures the gap, not the collapse.',
  },
];

/**
 * The worst tier anything in the row rests on.
 *
 * A row is only as good as its weakest figure, and saying so in a
 * column is more use than an average would be: an average of one
 * observed and one asserted figure is a number that describes neither.
 */
export function weakest(n: Niche): Tier {
  const tiers = [n.cost.tier, n.wtp.tier, ...n.evidence.map((e) => e.tier)];
  return tiers.reduce((worst, t) =>
    TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(worst) ? t : worst,
  );
}

/* -------------------------------------------------------------------
   The type ramp, as the proof page shows it
   ------------------------------------------------------------------- */

export interface Rung {
  token: string;
  size: string;
  use: string;
  family: 'display' | 'serif' | 'mono';
}

/**
 * The ramp, restated here so the page can show a specimen of each rung.
 *
 * The sizes are the ones declared in `styles.css`; if they drift apart
 * the proof is lying about the system it is proving, which is what
 * `test/style.test.ts` checks by reading the stylesheet.
 */
export const RAMP: Rung[] = [
  { token: '--t-2xs', size: '11px', use: 'Column heads and eyebrows, tracked and uppercase', family: 'mono' },
  { token: '--t-xs', size: '13px', use: 'Dense metadata', family: 'mono' },
  { token: '--t-sm', size: '16px', use: 'The floor. Table body, chips, captions', family: 'display' },
  { token: '--t-md', size: '17px', use: 'Reading text', family: 'display' },
  { token: '--t-lg', size: '21px', use: 'Panel headings', family: 'display' },
  { token: '--t-xl', size: '25px', use: 'View headings', family: 'display' },
  { token: '--t-2xl', size: '30px', use: 'Section statements, and the argued claim', family: 'serif' },
  { token: '--t-3xl', size: '44px', use: 'The one figure a page exists to say', family: 'mono' },
];

/* -------------------------------------------------------------------
   The observed-only filter
   ------------------------------------------------------------------- */

/** Whether a tier survives the filter at the given floor. */
export const survives = (tier: Tier, floor: Tier): boolean =>
  TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(floor);

export interface Emptied {
  /** Rows whose every figure was struck out. Kept, never removed. */
  gutted: number;
  /** Figures struck out across the table. */
  figuresLost: number;
  /** Evidence items struck out. */
  evidenceLost: number;
  /** Evidence items still standing. */
  evidenceKept: number;
}

/**
 * What the filter costs, computed rather than typed.
 *
 * The page states this in a sentence, and the sentence must not be able
 * to go stale, so it is assembled from these counts.
 */
export function emptied(niches: Niche[], floor: Tier): Emptied {
  let gutted = 0;
  let figuresLost = 0;
  let evidenceLost = 0;
  let evidenceKept = 0;

  for (const n of niches) {
    const figures = [n.cost, n.wtp];
    const lost = figures.filter((f) => !survives(f.tier, floor)).length;
    figuresLost += lost;
    if (lost === figures.length) gutted += 1;
    for (const e of n.evidence) {
      if (survives(e.tier, floor)) evidenceKept += 1;
      else evidenceLost += 1;
    }
  }

  return { gutted, figuresLost, evidenceLost, evidenceKept };
}

/* -------------------------------------------------------------------
   The threshold sweep
   ------------------------------------------------------------------- */

export interface Band {
  ref: string;
  name: string;
  status: Status;
  /** Null when the estimate does not exist. An absent band is the finding. */
  low: number | null;
  high: number | null;
  tier: Tier;
  /** Why there is no band, when there is none. */
  absence?: string;
}

/** The axis, ticked only at decades that a figure in the record reaches. */
export const AXIS = { min: 1, max: 200 };

export const AXIS_TICKS = [1, 10, 100, 200];

/**
 * Today's production cost, drawn as the line that descends.
 *
 * It is a range, not a line, and it is drawn as a range. Its top edge is
 * the conservative reading and is where the rule is struck.
 */
export const COST_LINE = {
  low: 1,
  high: 10,
  tier: 'reported' as Tier,
  label: 'Production cost today, $1–10 per finished minute',
};

/**
 * Willingness-to-pay bands.
 *
 * Two of the three have no band, and they are drawn as an absence
 * rather than as a plausible-looking rectangle. That is the whole
 * reason this frame is worth drawing: a sweep that invents intervals
 * for B-2 and C-3 would look better and say something false.
 */
export function bands(niches: Niche[]): Band[] {
  return niches.map((n) => {
    const parsed = parseRange(n.wtp.value);
    return {
      ref: n.ref,
      name: n.name,
      status: n.status,
      low: parsed?.low ?? null,
      high: parsed?.high ?? null,
      tier: n.wtp.tier,
      absence: parsed ? undefined : n.wtp.value,
    };
  });
}

/** `$50–200 per finished minute` becomes `{ low: 50, high: 200 }`. */
export function parseRange(text: string): { low: number; high: number } | null {
  const m = text.match(/\$(\d+(?:\.\d+)?)–(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const low = Number(m[1]);
  const high = Number(m[2]);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  return { low, high };
}

/**
 * Position on the log axis, as a percentage from the bottom.
 *
 * Log because the record spans two orders of magnitude and a linear
 * axis would put $1 and $10 on top of each other while giving the
 * studio price most of the height.
 */
export function logPos(value: number): number {
  const lo = Math.log10(AXIS.min);
  const hi = Math.log10(AXIS.max);
  return ((Math.log10(value) - lo) / (hi - lo)) * 100;
}

/**
 * Where a band sits relative to the cost line.
 *
 * This is the rule the sweep encodes, and it is deliberately capable of
 * returning `contested`: while the cost line is inside the band, the
 * honest answer is that we do not know.
 */
export function readSweep(band: Band, costTop: number): Status | null {
  if (band.low === null || band.high === null) return null;
  if (costTop < band.low) return 'threshold_crossed';
  if (costTop > band.high) return 'dormant';
  return 'contested';
}
