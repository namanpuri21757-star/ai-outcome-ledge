import type { ClaimKind, Dataset, LedgerRow, MeasurementBasis, VerificationStatus } from './types';

/* ===================================================================
   Synthetic rows, for looking at the interface without a database.

     cd web && VITE_FIXTURES=1 npx vite --port 5199

   Two independent guards keep this out of production: `import.meta.env.DEV`
   is replaced with `false` in a build, so the bundler drops the module
   and every call site, and VITE_FIXTURES must additionally be set.

   The generator is a fixed-seed LCG, so a screenshot difference means a
   layout change rather than a reshuffle. Company names are obviously
   invented — nobody should be able to mistake a fixture for a finding.

   It deliberately produces the awkward shapes the real corpus has and a
   naive generator would not: gain claims with no dollar figure, a traced
   figure on a claim with no dollar figure, companies with no filed
   series at all, and a claim too recent to have a reading a year later.
   =================================================================== */

const NAMES = [
  'Northwind Logistics', 'Castleford Group', 'Meridian Health', 'Alderpoint Software',
  'Brightwater Utilities', 'Calder & Finch', 'Dunmore Manufacturing', 'Eastvale Retail',
  'Fenwick Insurance', 'Glasshouse Media', 'Harrowgate Bank', 'Ivorycliff Legal',
  'Junction Systems', 'Kestrel Support Co', 'Lanternhill Foods', 'Marchmont Telecom',
  'Netherby Analytics', 'Oakhurst Staffing', 'Pemberton Freight', 'Quarrybrook Energy',
  'Redgate Pharmacy', 'Stonebridge BPO', 'Thornbury Travel', 'Underhill Devices',
  'Vantage Point Labs', 'Westmoor Chemicals', 'Yarrow Education', 'Zephyr Payments',
  'Ashcombe Textiles', 'Blackfriars Audit', 'Cranleigh Motors', 'Dellwood Housing',
  'Elmsworth Mining', 'Foxglove Studios', 'Greenholt Farms', 'Hartsmere Shipping',
  'Inglewood Security', 'Jarrowfield Steel', 'Kingsmoor Realty', 'Larkspur Robotics',
  'Millbrook Survey Group', 'Norfolk Ridge Trials', 'Overton Panel Study',
  'Pinehaven Register', 'Quillsbury Index',
];

const SECTORS = [
  'Software', 'Healthcare', 'Financial services', 'Logistics', 'Retail',
  'Telecom', 'Professional services', 'Manufacturing', 'Energy', 'Education',
];
const GROUP_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const BASES: MeasurementBasis[] = [
  'gross_capacity', 'net_pl', 'unit_economics', 'headcount', 'time', 'quality', 'activity', 'unverified',
];
const VERIFY: VerificationStatus[] = [
  'verified_primary', 'secondary_only', 'needs_primary_source', 'disputed',
];
const SOURCE_TYPES = ['sec_filing', 'earnings_call', 'press_release', 'press', 'vendor_report', 'peer_reviewed'];

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const slugOf = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function syntheticRows(): LedgerRow[] {
  const rand = rng(20260815);
  const rows: LedgerRow[] = [];
  let n = 0;

  NAMES.forEach((name, i) => {
    const slug = slugOf(name);
    // The last five are research populations, matching the real corpus.
    const isResearch = i >= NAMES.length - 5;
    const isPublic = !isResearch && rand() > 0.3;
    const count = rand() > 0.8 ? 3 : rand() > 0.5 ? 2 : 1;

    for (let c = 0; c < count; c++) {
      n += 1;
      const roll = rand();
      const kind: ClaimKind = isResearch
        ? 'research_finding'
        : roll > 0.72 ? 'gain_claim'
        : roll > 0.52 ? 'counter_evidence'
        : roll > 0.36 ? 'context'
        : roll > 0.28 ? 'pricing'
        : 'gain_claim';

      const dRoll = rand();
      const dest = kind !== 'gain_claim' ? 0
        : dRoll > 0.82 ? 5 : dRoll > 0.7 ? 4 : dRoll > 0.56 ? 3 : dRoll > 0.38 ? 2 : dRoll > 0.14 ? 1 : 0;

      // Only some gain claims name dollars — 14 of 32 do in the real corpus.
      const namesDollars = kind === 'gain_claim' && rand() > 0.55;
      const claimed = namesDollars ? Math.round((rand() ** 2.4 * 900 + 4) * 1e6) : null;

      // Traced dollars are rare and concentrated, and one row carries a
      // traced figure against a claim with no dollar amount at all —
      // the exact shape that produced two different totals last time.
      const tracedShare = dest === 5 ? 0.35 + rand() * 0.65 : dest === 4 ? rand() * 0.2 : 0;
      const traced = claimed !== null
        ? Math.round(claimed * tracedShare)
        : kind === 'gain_claim' && n % 17 === 0 ? 23_100_000 : 0;

      // Recent claims cannot yet have a reading a year later.
      const year = 2024 + (n % 3);
      const month = 1 + (n % 12);
      const claimDate = `${year}-${String(month).padStart(2, '0')}-15`;

      const coded = rand() > 0.28;
      const cond = () => (coded ? rand() > 0.45 : null);

      rows.push({
        id: `fixture-${n}`,
        ref: `${slug}-fixture-${c + 1}`,
        claim_date: claimDate,
        period_label: `Q${1 + (n % 4)} ${year}`,
        headline: `${name} reports ${
          namesDollars ? `$${Math.round((claimed ?? 0) / 1e6)}M of` : `a ${10 + (n % 80)}%`
        } AI-attributed improvement in ${SECTORS[i % SECTORS.length].toLowerCase()} operations (synthetic fixture)`,
        claim_detail:
          rand() > 0.25
            ? 'Synthetic fixture row. Every figure on this row is generated for layout work and means nothing.'
            : null,
        claim_kind: kind,
        claimed_amount_usd: claimed,
        claimed_value: namesDollars ? Math.round((claimed ?? 0) / 1e6) : 10 + (n % 80),
        claimed_unit: namesDollars ? 'usd' : 'pct',
        measurement_basis: BASES[n % BASES.length],
        measurement_definition:
          rand() > 0.2 ? 'The source defines this as a synthetic quantity for fixture purposes.' : null,
        destination: dest,
        destination_rationale: coded ? 'Coded from the synthetic rationale field.' : null,
        counterparty_absorbed: dest === 3,
        counterparty_note: dest === 3 ? 'A synthetic supplier absorbed the difference.' : null,
        transfer_amount_usd: dest === 3 && claimed ? Math.round(claimed * 0.6) : null,
        traceable_to_pl_usd: traced,
        unreconciled_usd: (claimed ?? 0) - traced,
        reconciliation_note: traced > 0 ? 'Matched to a synthetic line item.' : null,
        observed_counter_move:
          kind === 'counter_evidence' ? 'A synthetic cost line moved the other way.' : null,
        cond_billing_unit_survives: cond(),
        cond_demand_sink: cond(),
        cond_permission_to_act: cond(),
        conditions_note: null,
        epistemic_tag: rand() > 0.5 ? 'fact' : rand() > 0.5 ? 'strong' : 'inference',
        evidence_tier: 1 + (n % 3),
        conflict_of_interest: rand() > 0.7,
        coi_note: null,
        verification_status: VERIFY[n % VERIFY.length],
        verify_hint: 'Synthetic next step: this row is not real and needs no checking.',
        source_type: SOURCE_TYPES[n % SOURCE_TYPES.length],
        source_name: `${name} synthetic disclosure`,
        // Deliberately null, exactly as in the real corpus.
        source_url: null,
        source_date: claimDate,
        company_name: name,
        company_slug: slug,
        company_ticker: isPublic ? slug.slice(0, 4).toUpperCase() : null,
        sector: SECTORS[i % SECTORS.length],
        group_code: isResearch ? 'R' : GROUP_CODES[i % GROUP_CODES.length],
        group_label: null,
        company_is_public: isPublic,
        counterparty_name: null,
        counterparty_slug: null,
        margin_delta_1q_bps: null,
        margin_delta_4q_bps: null,
        margin_baseline: null,
        margin_t4q: null,
        price_delta_4q: null,
      });
    }
  });

  return rows.sort((a, b) => b.claim_date.localeCompare(a.claim_date));
}

/** Quarterly series for roughly the companies that would file. */
function syntheticSeries(rows: LedgerRow[]): Dataset['series'] {
  const out: Dataset['series'] = new Map();
  const slugs = [...new Set(rows.filter((r) => r.company_is_public).map((r) => r.company_slug))];

  for (const slug of slugs) {
    const seed = [...slug].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const rand = rng(seed);
    // A quarter of filers publish nothing the collector can read.
    if (rand() > 0.75) continue;

    const margin: Array<{ date: string; value: number }> = [];
    const revenue: Array<{ date: string; value: number }> = [];
    let level = 0.02 + rand() * 0.16;
    let rev = (200 + rand() * 4000) * 1e6;

    for (let q = 0; q < 24; q++) {
      const year = 2020 + Math.floor(q / 4);
      const month = [3, 6, 9, 12][q % 4];
      const date = `${year}-${String(month).padStart(2, '0')}-${month === 6 || month === 9 ? '30' : '31'}`;
      level += (rand() - 0.48) * 0.02;
      rev *= 1 + (rand() - 0.45) * 0.06;
      margin.push({ date, value: Math.round(level * 1e6) / 1e6 });
      revenue.push({ date, value: Math.round(rev) });
    }
    out.set(slug, new Map([['operating_margin_q', margin], ['revenue_q', revenue]]));
  }
  return out;
}

export function syntheticDataset(): Dataset {
  const rows = syntheticRows();
  return { rows, companies: [], series: syntheticSeries(rows) };
}

export const useFixtures =
  import.meta.env.DEV && import.meta.env.VITE_FIXTURES === '1';
