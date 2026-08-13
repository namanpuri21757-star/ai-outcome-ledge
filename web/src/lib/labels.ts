import type { ClaimKind, MeasurementBasis, VerificationStatus } from './types';

/* ===================================================================
   VOCABULARY

   Every label a reader sees lives here and nowhere else.

   The rule this file enforces: database codes are for the database.
   `5` is a destination rank, not a quantity, and rendering it as
   "5 Margin" asks the reader to decode before they can read. The rank
   still carries real information — how close the gain got to profit —
   so it is preserved as `rank` and drawn as position on a ladder,
   which is what position is for.

   The codes survive in the CSV export and in each row's fine print,
   so nothing is lost for analysis.
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

/** Left-to-right, furthest from profit first. Position replaces the numeral. */
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
    meaning: 'A price per unit of output. The mechanism by which value passes through, not a saving anyone booked.',
  },
  research_finding: {
    name: 'Research',
    meaning: 'Population-level evidence. The counterweight to every firm-level claim here.',
  },
};

export const VERIFICATION: Record<VerificationStatus, { name: string; meaning: string }> = {
  verified_primary: { name: 'Primary source', meaning: 'Checked against a filing, dataset, or peer-reviewed paper.' },
  secondary_only: { name: 'Secondary only', meaning: 'Sourced to press or company communications, not to a primary document.' },
  needs_primary_source: { name: 'Needs checking', meaning: 'No primary source located yet. The next step is written on the row.' },
  disputed: { name: 'Disputed', meaning: 'Credible sources conflict and the conflict has not been resolved.' },
};

export const TIERS: Record<number, string> = {
  1: 'Primary — a filing, administrative dataset, or peer-reviewed paper',
  2: 'Vendor- or self-originated',
  3: 'Press or secondary reporting',
};

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

/** Phrases used in more than one place. Kept here so they cannot drift apart. */
export const COPY = {
  traced: 'Traceable to a filing line',
  untraced: 'Not traceable to a filing line',
  tracedShort: 'Traceable',
  untracedShort: 'Not traceable',
  untracedMeaning:
    'The claimed figure cannot be matched to a named line item in a financial statement. It does not mean the claim is false — several of these are audited and true. It measures the distance between a number being real and a number being locatable.',
  absorbed: 'Absorbed by a supplier',
};
