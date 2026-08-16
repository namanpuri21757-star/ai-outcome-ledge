import type { ViewName } from './route';
import type { ClaimKind, EpistemicTag, MeasurementBasis, VerificationStatus } from './types';

/* ===================================================================
   VOCABULARY — every user-facing label, and every definition of one.

   Two rules this file enforces.

   **Database codes are for the database.** `5` is a destination rank,
   not a quantity, and rendering it as "5 Margin" asks the reader to
   decode before they can read. The rank still carries real information —
   how close the gain got to profit — so it is kept as `rank` and used
   for ordering. The codes survive in the CSV export and in each row's
   fine print, so nothing is lost for analysis.

   **A coded term is never shown without a way to learn what it means.**
   Every definition a reader can open comes from `define()` below, which
   reads the same maps the labels come from. There is no second copy of
   any definition text anywhere in `src/`, and none in the stylesheet.
   =================================================================== */

export interface DestinationLabel {
  /** 0..5 as stored. Order is meaningful: distance from profit. */
  rank: number;
  /** Column heading and chip text. */
  name: string;
  /** Reads after a company name: "IBM's gains were …" */
  verb: string;
  /** One line explaining the category. */
  meaning: string;
  /** CSS accent class. */
  tone: 'slack' | 'quality' | 'transfer' | 'price' | 'margin' | 'none';
}

export const DESTINATIONS: Record<number, DestinationLabel> = {
  0: {
    rank: 0,
    name: 'Not coded',
    verb: 'not yet coded',
    meaning:
      'Either the source never said what was measured, or the five destinations do not apply to this row.',
    tone: 'none',
  },
  1: {
    rank: 1,
    name: 'Absorbed as slack',
    verb: 'absorbed as slack',
    meaning:
      'The hours were freed and stayed inside the business. Nothing left the cost base, so nothing changed financially.',
    tone: 'slack',
  },
  2: {
    rank: 2,
    name: 'Kept as quality',
    verb: 'converted into quality',
    meaning:
      'A real, often well-measured gain that landed in wellbeing, service, or cycle time. There is no P&L line for it.',
    tone: 'quality',
  },
  3: {
    rank: 3,
    name: 'Taken from a supplier',
    verb: 'taken off a supplier',
    meaning:
      "The buyer's saving is a supplier's revenue decline. A transfer between two firms, not new productivity.",
    tone: 'transfer',
  },
  4: {
    rank: 4,
    name: 'Passed to customers',
    verb: 'passed through to customers',
    meaning:
      'The surplus reached the buyer of the AI through a lower price. Value was created; the seller did not keep it.',
    tone: 'price',
  },
  5: {
    rank: 5,
    name: 'Kept as margin',
    verb: 'kept as margin',
    meaning:
      'Retained as profit. Requires the billing unit to survive, somewhere for the freed capacity to go, and permission to act.',
    tone: 'margin',
  },
};

/** Furthest from profit first, uncoded last. The only ordering in the app. */
export const DESTINATION_ORDER = [1, 2, 3, 4, 5, 0];

export function destination(rank: number | null | undefined): DestinationLabel {
  return DESTINATIONS[rank ?? 0] ?? DESTINATIONS[0];
}

/* ------------------------------------------------------------------ */

export interface BasisLabel {
  name: string;
  meaning: string;
  /** True when the number is not money that moved. */
  soft: boolean;
}

export const BASES: Record<MeasurementBasis, BasisLabel> = {
  gross_capacity: {
    name: 'Hours freed',
    meaning:
      'Time or headcount freed, multiplied by what those people cost. It is a valuation of capacity, not a cost line that moved.',
    soft: true,
  },
  net_pl: {
    name: 'A line item moved',
    meaning: 'A disclosed cost or revenue line changed, or an audited saving was booked.',
    soft: false,
  },
  unit_economics: {
    name: 'Price per unit',
    meaning: 'A price or margin per unit of output — per resolution, per ticket, per conversation.',
    soft: false,
  },
  headcount: { name: 'People', meaning: 'A change in the number of employees.', soft: true },
  time: { name: 'Time', meaning: 'Hours or delay saved, not converted into money.', soft: true },
  quality: {
    name: 'Quality',
    meaning: 'Satisfaction, burnout, error rate. Measured, and not money.',
    soft: true,
  },
  activity: {
    name: 'Usage volume',
    meaning: 'Counts of things happening — tickets, chats, users, deflection rates.',
    soft: true,
  },
  unverified: {
    name: "Source doesn't say",
    meaning:
      'The source never defined what the number counts. This is a status, not an accusation: the claim may well be true.',
    soft: true,
  },
};

export const BASIS_ORDER: MeasurementBasis[] = [
  'net_pl', 'unit_economics', 'gross_capacity', 'headcount', 'time', 'quality', 'activity', 'unverified',
];

export function basis(key: MeasurementBasis): BasisLabel {
  return BASES[key] ?? BASES.unverified;
}

/* ------------------------------------------------------------------ */

export const KINDS: Record<ClaimKind, { name: string; meaning: string }> = {
  gain_claim: {
    name: 'Gain claim',
    meaning: 'Someone asserted that AI produced a gain. Only these rows count toward the money totals.',
  },
  counter_evidence: {
    name: 'Counter-evidence',
    meaning: 'An observation that contradicts or bounds a gain claim.',
  },
  context: {
    name: 'Context',
    meaning: 'Spend, deal values, adoption rates, methods. Real and useful, but not a gain.',
  },
  pricing: {
    name: 'Pricing',
    meaning:
      'A price per unit of output. The mechanism by which value passes through, not a saving anyone booked.',
  },
  research_finding: {
    name: 'Research',
    meaning: 'Population-level evidence. The counterweight to every firm-level claim here.',
  },
};

export const KIND_ORDER: ClaimKind[] = [
  'gain_claim', 'counter_evidence', 'research_finding', 'context', 'pricing',
];

export function kind(key: ClaimKind): { name: string; meaning: string } {
  return KINDS[key] ?? { name: key, meaning: '' };
}

export const VERIFICATION: Record<VerificationStatus, { name: string; meaning: string }> = {
  verified_primary: {
    name: 'Primary source',
    meaning: 'Checked against a filing, dataset, or peer-reviewed paper.',
  },
  secondary_only: {
    name: 'Secondary only',
    meaning: 'Sourced to press or company communications, not to a primary document.',
  },
  needs_primary_source: {
    name: 'Needs checking',
    meaning: 'No primary source located yet. The next step is written on the row.',
  },
  disputed: {
    name: 'Disputed',
    meaning: 'Credible sources conflict and the conflict has not been resolved.',
  },
};

export const VERIFICATION_ORDER: VerificationStatus[] = [
  'verified_primary', 'secondary_only', 'needs_primary_source', 'disputed',
];

export function verification(key: VerificationStatus): { name: string; meaning: string } {
  return VERIFICATION[key] ?? { name: key, meaning: '' };
}

export const TIERS: Record<number, string> = {
  1: 'Primary — a filing, administrative dataset, or peer-reviewed paper.',
  2: 'Vendor- or self-originated, so the source has an interest in the number.',
  3: 'Press or secondary reporting, at one remove from the document.',
};

/**
 * How confident the coder is in the row, as distinct from how good the
 * source is. Previously rendered as the raw enum string with no label
 * and no definition anywhere.
 */
export const EPISTEMIC: Record<EpistemicTag, { name: string; meaning: string }> = {
  fact: { name: 'Stated fact', meaning: 'The source states it directly and the row repeats it.' },
  strong: {
    name: 'Strong reading',
    meaning: 'Not stated in these words, but the source supports it closely.',
  },
  inference: {
    name: 'Inference',
    meaning: 'Derived from the source by a step of reasoning that could be argued with.',
  },
  speculation: {
    name: 'Speculation',
    meaning: 'A reading worth recording that the source does not establish.',
  },
  unknown: { name: 'Unclassified', meaning: 'Confidence in this row has not been coded yet.' },
};

export function epistemic(key: EpistemicTag): { name: string; meaning: string } {
  return EPISTEMIC[key] ?? EPISTEMIC.unknown;
}

/* ------------------------------------------------------------------ */

export const CONDITIONS = {
  billing: {
    key: 'billing' as const,
    name: 'Billing unit survives',
    question: 'Does the firm still get paid once AI does the work?',
    passes: 'They sell an output AI produces, so doing more of it earns more.',
    fails: 'They sell the input AI destroys — the hour, the seat, the agent — so working faster bills less.',
  },
  sink: {
    key: 'sink' as const,
    name: 'Somewhere for the capacity to go',
    question: 'Is there unmet demand waiting for the freed hours?',
    passes: 'An order book, a queue, or a backlog absorbs the freed capacity immediately.',
    fails: 'The freed hours have nowhere to go, so they become idle time rather than output.',
  },
  permission: {
    key: 'permission' as const,
    name: 'Permission to act',
    question: 'Is the firm allowed to change how the work is done?',
    passes: 'No client sign-off, regulator, or licensure blocks the change.',
    fails: 'Change control, compliance review, licensure, or labour agreements slow or prevent the change.',
  },
};

export const CONDITION_LIST = [CONDITIONS.billing, CONDITIONS.sink, CONDITIONS.permission];
export type ConditionKey = keyof typeof CONDITIONS;

/* ------------------------------------------------------------------ */

export const GROUPS: Record<string, { name: string; blurb: string }> = {
  A: { name: 'AI-native', blurb: 'Built around AI from the start. No legacy workflow, no labour to displace.' },
  B: { name: 'AI-native roll-up', blurb: 'Builds the software first, then buys the operating company.' },
  C: { name: 'Platform vendor', blurb: 'Runs its own AI internally, and the deployment doubles as sales collateral.' },
  D: { name: 'Large incumbent', blurb: 'Big, often regulated, retrofitting AI into an existing business.' },
  E: { name: 'Professional services', blurb: 'Bills by the hour into a market with idle capacity.' },
  F: { name: 'BPO supplier', blurb: "Where other companies' savings land as lost revenue." },
  G: { name: 'Healthcare', blurb: 'Well-measured gains, fixed appointment book, no route to money.' },
  H: { name: 'Manufacturing', blurb: 'Capacity-constrained with an order book — the control group.' },
  I: { name: 'Small business', blurb: 'No project, no budget, no measurement. AI arrives as a feature update.' },
  J: { name: 'Demand destroyed', blurb: 'AI removed the customers, not the costs.' },
  R: { name: 'Research', blurb: 'Population-level evidence rather than a firm.' },
};

export function group(code: string | null | undefined): { name: string; blurb: string } {
  return GROUPS[code ?? ''] ?? { name: 'Unclassified', blurb: '' };
}

/* ------------------------------------------------------------------ */

/** Phrases used in more than one place, so they cannot drift apart. */
export const COPY = {
  traced: 'Traceable to a filing line',
  untraced: 'Not traceable to a filing line',
  tracedShort: 'Traceable',
  untracedShort: 'Not traceable',
  untracedMeaning:
    'The claimed figure cannot be matched to a named line item in a financial statement. It does not mean the claim is false — several of these claims are audited and true. It measures the distance between a number being real and a number being locatable.',
  absorbed: 'Absorbed by a supplier',
  title: 'AI Outcome Ledger',
  strapline:
    'Every public claim of an AI gain, coded against what was actually measured.',
};

/**
 * The three places in the nav. Read by the masthead and by the landing
 * page's top bar, so the two cannot come to disagree about what a
 * section is called.
 */
export const NAV: Array<{ view: ViewName; label: string }> = [
  { view: 'ledger', label: 'The ledger' },
  { view: 'method', label: 'Method' },
  { view: 'maintenance', label: 'Maintenance' },
];

/**
 * The landing page. It is the only surface written rather than
 * assembled, because it has to say what the project is before any row
 * has loaded — so it states no fact about the data. Every number a
 * visitor sees there comes from the row itself.
 */
export const LANDING_COPY = {
  headline:
    'Everyone is spending billions on AI and claiming it is improving their business. But is it really?',
  standfirst:
    'This is a public record of those claims, each one checked against what the company actually measured and what its filings actually show.',
  exampleHead: 'One row, in full',
  enter: 'Let me show you what I mean.',
  // Supplied verbatim, straight apostrophe included. Not restyled to the
  // typographic apostrophe used elsewhere: it was given as exact text.
  prices: "AI got cheaper, why isn't everyone out pricing",
  dive: 'Dive in',
  openRow: 'Open this row',
  directoryHead: 'Every company in the ledger',
  cardOpen: 'Open the record',
};

/* ===================================================================
   DEFINITIONS

   One function. Everything that opens an explanation in the interface
   goes through it, and it reads the maps above rather than holding a
   second copy of the words.
   =================================================================== */

export type DefinitionKind =
  | 'destination'
  | 'basis'
  | 'kind'
  | 'verification'
  | 'tier'
  | 'epistemic'
  | 'condition'
  | 'group'
  | 'phrase';

export interface Definition {
  /** What the reader clicked. */
  label: string;
  /** The explanation. Always at least one full sentence. */
  body: string;
  /** Extra lines, e.g. what passing and failing a condition look like. */
  extra?: string[];
}

/** Standing phrases that are coded vocabulary without being a column. */
export const PHRASES: Record<string, Definition> = {
  traceable: { label: COPY.tracedShort, body: COPY.untracedMeaning },
  untraceable: { label: COPY.untracedShort, body: COPY.untracedMeaning },
  claimed: {
    label: 'Claimed',
    body: 'The figure as the source asserted it, in dollars. Only gain claims that named a dollar amount are counted, so that a market capitalisation and a savings figure never land in one total.',
  },
  destination: {
    label: 'Where it landed',
    body: 'One of five places a freed hour can end up, ordered by distance from profit. Only the last of them is margin.',
  },
  basis: {
    label: 'What was measured',
    body: 'What the claimed number actually counts, according to the source itself. It is the difference between an audited cost line and an hourly rate multiplied by a headcount.',
  },
  conditions: {
    label: 'The three conditions',
    body: 'A gain reaches profit only when the firm still gets paid for the work, has somewhere to put the freed capacity, and is allowed to change how the work is done. Rows are coded against all three, and an uncoded condition is not a failed one.',
  },
  margin_window: {
    label: 'Operating margin around the claim',
    body: 'The last operating margin the company filed before the claim, and the readings a quarter and a year after it, taken from SEC XBRL data. A margin that moved is consistent with a claim; it is not evidence for it, because operating margin moves for many reasons at once.',
  },
};

export function define(kind: DefinitionKind, key: string | number): Definition | null {
  switch (kind) {
    case 'destination': {
      const d = destination(Number(key));
      return { label: d.name, body: d.meaning };
    }
    case 'basis': {
      const b = BASES[key as MeasurementBasis];
      return b ? { label: b.name, body: b.meaning } : null;
    }
    case 'kind': {
      const k = KINDS[key as ClaimKind];
      return k ? { label: k.name, body: k.meaning } : null;
    }
    case 'verification': {
      const v = VERIFICATION[key as VerificationStatus];
      return v ? { label: v.name, body: v.meaning } : null;
    }
    case 'tier': {
      const t = TIERS[Number(key)];
      return t ? { label: `Evidence tier ${key}`, body: t } : null;
    }
    case 'epistemic': {
      const e = EPISTEMIC[key as EpistemicTag];
      return e ? { label: e.name, body: e.meaning } : null;
    }
    case 'condition': {
      const c = CONDITIONS[key as ConditionKey];
      return c
        ? {
            label: c.name,
            body: c.question,
            extra: [`Passes when: ${c.passes}`, `Fails when: ${c.fails}`],
          }
        : null;
    }
    case 'group': {
      const g = GROUPS[String(key)];
      return g && g.blurb ? { label: g.name, body: g.blurb } : null;
    }
    case 'phrase':
      return PHRASES[String(key)] ?? null;
  }
}

/**
 * Every definition in the app, generated. The Method page renders this
 * rather than a typed list, so a vocabulary entry cannot exist without
 * appearing there.
 */
export function glossary(): Array<{ heading: string; items: Array<Definition & { code: string }> }> {
  return [
    {
      heading: 'Where the gain landed',
      items: DESTINATION_ORDER.map((r) => ({ ...define('destination', r)!, code: String(r) })),
    },
    {
      heading: 'What was measured',
      items: BASIS_ORDER.map((b) => ({ ...define('basis', b)!, code: b })),
    },
    {
      heading: 'Kind of row',
      items: KIND_ORDER.map((k) => ({ ...define('kind', k)!, code: k })),
    },
    {
      heading: 'The three conditions',
      items: CONDITION_LIST.map((c) => ({ ...define('condition', c.key)!, code: c.key })),
    },
    {
      heading: 'How well sourced',
      items: [
        ...VERIFICATION_ORDER.map((v) => ({ ...define('verification', v)!, code: v })),
        ...[1, 2, 3].map((t) => ({ ...define('tier', t)!, code: String(t) })),
      ],
    },
    {
      heading: 'How confident the coding is',
      items: (Object.keys(EPISTEMIC) as EpistemicTag[]).map((e) => ({
        ...define('epistemic', e)!,
        code: e,
      })),
    },
    {
      heading: 'Kind of company',
      items: Object.keys(GROUPS).map((g) => ({ ...define('group', g)!, code: g })),
    },
    {
      heading: 'Standing terms',
      items: Object.keys(PHRASES).map((p) => ({ ...define('phrase', p)!, code: p })),
    },
  ];
}
