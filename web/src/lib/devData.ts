import type { LedgerRow } from './types';

/* ===================================================================
   SYNTHETIC ROWS — LOCAL RENDERING ONLY

   This is not data. Every company name below is invented and every
   figure is generated from a fixed seed. It exists so the interface
   can be built and screenshotted at full density without a database
   connection, and so the layout is exercised against forty-five
   companies rather than the six in the test corpus.

   It must never reach a reader. Two guards:

     1. Everything here is behind `import.meta.env.DEV`, which the
        production build replaces with `false`, so the bundler removes
        this module and its call sites entirely.
     2. It only activates when VITE_FIXTURES=1 is set explicitly.

   The real ledger is hand-coded from primary sources. Nothing in this
   file is a claim about any real company, and no figure here should
   ever be quoted.
   =================================================================== */

/** Deterministic, so a screenshot diff means a layout change and not
 *  a reshuffled dataset. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SECTORS = [
  'Banking', 'Software', 'Telecoms', 'Healthcare', 'Retail',
  'Professional services', 'Logistics', 'Manufacturing', 'Education', 'Insurance',
];
const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const BASES = ['gross_capacity', 'net_pl', 'unit_economics', 'activity', 'time', 'unverified'] as const;

const NAMES = [
  'Northwind', 'Acme Group', 'Meridian', 'Blue Harbour', 'Castleford',
  'Dunmore', 'Everline', 'Fairhaven', 'Glenrock', 'Halcyon',
  'Ironbridge', 'Juniper Bank', 'Kestrel', 'Lambourne', 'Marchmont',
  'Norbury', 'Oakfield', 'Pemberton', 'Quarrymill', 'Redcastle',
  'Stanhope', 'Thornbury', 'Underhill', 'Vexley', 'Westmarch',
  'Yarrow', 'Ashcombe', 'Bramley', 'Coldstream', 'Dalewood',
  'Elmsworth', 'Fenchurch', 'Garrowby', 'Hartsmere', 'Inverleith',
  'Kingsmoor', 'Larchfield', 'Mossbank', 'Netherby', 'Oldbury',
  'Pinehurst', 'Ravensworth', 'Sedgemoor', 'Tarnbrook', 'Ullswater',
];

const HEADLINES = [
  'reports hours returned to the business after a support deployment',
  'says an internal assistant cut handling time across its service desk',
  'attributes a cost reduction to automated document review',
  'describes freed engineering capacity redeployed into delivery',
  'books an audited saving against its operations line',
  'reports a lower cost per resolved ticket',
];

export function syntheticRows(): LedgerRow[] {
  const rand = rng(20260815);
  const rows: LedgerRow[] = [];
  let n = 0;

  NAMES.forEach((name, i) => {
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '-');
    const sector = SECTORS[i % SECTORS.length];
    const groupCode = GROUPS[i % GROUPS.length];
    const isPublic = rand() > 0.25;

    // Most companies carry one row; some carry two or three, which is
    // what makes the company roll-up worth testing.
    const count = rand() > 0.78 ? 3 : rand() > 0.5 ? 2 : 1;

    for (let k = 0; k < count; k++) {
      n += 1;
      const r = rand();
      const destination = r < 0.34 ? 1 : r < 0.5 ? 2 : r < 0.62 ? 3 : r < 0.7 ? 4 : r < 0.82 ? 5 : 0;
      const hasAmount = rand() > 0.16;
      const claimed = hasAmount ? Math.round((rand() ** 2.4) * 900_000_000 + 4_000_000) : null;
      // Only rows that reached margin tend to have anything traceable.
      const tracedShare = destination === 5 ? 0.35 + rand() * 0.65 : destination === 4 ? rand() * 0.2 : 0;
      const traced = claimed ? Math.round(claimed * tracedShare) : 0;

      const coded = rand() > 0.22;
      const billing = coded ? rand() > 0.45 : null;
      const sink = coded ? rand() > 0.5 : null;
      const permission = coded ? rand() > 0.4 : null;

      const measured = isPublic && rand() > 0.45;
      const kind =
        rand() > 0.88 ? 'counter_evidence' : rand() > 0.86 ? 'context' : 'gain_claim';

      const absorbed = destination === 3;

      rows.push({
        id: `synthetic-${n}`,
        ref: `syn-${n}`,
        claim_date: `202${4 + (n % 3)}-${String(1 + (n % 12)).padStart(2, '0')}-15`,
        period_label: `Q${1 + (n % 4)} 202${4 + (n % 3)}`,
        headline: `${name} ${HEADLINES[n % HEADLINES.length]}`,
        claim_detail: null,
        claim_kind: kind as LedgerRow['claim_kind'],
        claimed_amount_usd: claimed,
        claimed_value: null,
        claimed_unit: null,
        measurement_basis: BASES[n % BASES.length],
        measurement_definition: null,
        destination,
        destination_rationale: null,
        counterparty_absorbed: absorbed,
        counterparty_note: null,
        transfer_amount_usd: absorbed && claimed ? Math.round(claimed * 0.6) : null,
        traceable_to_pl_usd: traced,
        unreconciled_usd: (claimed ?? 0) - traced,
        reconciliation_note: null,
        observed_counter_move: rand() > 0.8 ? 'A figure moved the other way over the same period.' : null,
        cond_billing_unit_survives: billing,
        cond_demand_sink: sink,
        cond_permission_to_act: permission,
        conditions_note: null,
        epistemic_tag: 'fact',
        evidence_tier: rand() > 0.6 ? 1 : rand() > 0.4 ? 2 : 3,
        conflict_of_interest: rand() > 0.82,
        coi_note: null,
        verification_status: rand() > 0.55 ? 'verified_primary' : 'secondary_only',
        verify_hint: null,
        source_type: 'sec_filing',
        source_name: 'Synthetic fixture',
        source_url: null,
        source_date: null,
        company_name: name,
        company_slug: slug,
        company_ticker: isPublic ? name.slice(0, 3).toUpperCase() : null,
        sector,
        group_code: groupCode,
        group_label: '',
        company_is_public: isPublic,
        counterparty_name: absorbed ? 'Unnamed supplier' : null,
        counterparty_slug: null,
        margin_delta_1q_bps: measured ? Math.round((rand() - 0.45) * 120) : null,
        margin_delta_4q_bps: measured ? Math.round((rand() - 0.45) * 260) : null,
        margin_baseline: null,
        margin_t4q: null,
        price_delta_4q: null,
      });
    }
  });

  return rows;
}

/**
 * A synthetic operating-margin series.
 *
 * The margin chart is the one element that reads from `observations`
 * rather than from the ledger rows, so under fixtures it used to draw
 * its own failure state and nothing else. That made the most important
 * chart in the application the one thing that could not be looked at
 * before shipping a change to it.
 *
 * Roughly a fifth of companies return nothing, because "this company
 * does not file with the SEC" is a real and common state that the
 * empty note has to be seen in. One in eight quarters is missing, so
 * the line's break-on-gap behaviour is exercised too.
 */
export function syntheticMargins(slug: string): Array<{ date: string; margin: number | null }> {
  const seed = [...slug].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rand = rng(seed);

  if (rand() < 0.2) return [];

  const level = 0.02 + rand() * 0.16;
  const drift = (rand() - 0.5) * 0.02;
  const out: Array<{ date: string; margin: number | null }> = [];

  for (let q = 0; q < 20; q += 1) {
    const year = 2021 + Math.floor(q / 4);
    const month = [3, 6, 9, 12][q % 4];
    const day = month === 3 || month === 12 ? 31 : 30;
    out.push({
      date: `${year}-${String(month).padStart(2, '0')}-${day}`,
      margin: rand() < 0.12 ? null : level + drift * q + (rand() - 0.5) * 0.012,
    });
  }
  return out;
}

/** True only in a local dev server started with VITE_FIXTURES=1. */
export const useFixtures =
  import.meta.env.DEV && import.meta.env.VITE_FIXTURES === '1';
