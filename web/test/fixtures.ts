import type { LedgerRow } from '../src/lib/types';

/**
 * One fully-populated row, patched per test. Every field is present, so
 * a test that cares about one column does not silently depend on
 * another being undefined.
 */
export function row(patch: Partial<LedgerRow> = {}): LedgerRow {
  return {
    id: patch.ref ?? 'id-1',
    ref: 'ref-1',
    claim_date: '2025-06-30',
    period_label: 'Q2 2025',
    headline: 'A company reports a saving',
    claim_detail: null,
    claim_kind: 'gain_claim',
    claimed_amount_usd: 100,
    claimed_value: 100,
    claimed_unit: 'usd',
    measurement_basis: 'net_pl',
    measurement_definition: 'An audited cost line.',
    destination: 5,
    destination_rationale: null,
    counterparty_absorbed: false,
    counterparty_note: null,
    transfer_amount_usd: null,
    traceable_to_pl_usd: 0,
    unreconciled_usd: 100,
    reconciliation_note: null,
    observed_counter_move: null,
    cond_billing_unit_survives: true,
    cond_demand_sink: true,
    cond_permission_to_act: true,
    conditions_note: null,
    epistemic_tag: 'fact',
    evidence_tier: 1,
    conflict_of_interest: false,
    coi_note: null,
    verification_status: 'verified_primary',
    verify_hint: 'Check the 10-K.',
    source_type: 'sec_filing',
    source_name: 'FY2025 10-K',
    source_url: null,
    source_date: '2025-07-01',
    company_name: 'Acme Corp',
    company_slug: 'acme',
    company_ticker: 'ACME',
    sector: 'Software',
    group_code: 'D',
    group_label: null,
    company_is_public: true,
    counterparty_name: null,
    counterparty_slug: null,
    margin_delta_1q_bps: null,
    margin_delta_4q_bps: null,
    margin_baseline: null,
    margin_t4q: null,
    price_delta_4q: null,
    ...patch,
  };
}

/**
 * A corpus shaped like the real one, including the two rows that broke
 * the previous build:
 *
 *   `chegg-shape`  a traced figure on a claim with no dollar amount —
 *                  the entire $23.1M difference between the two totals
 *                  the old app showed at once.
 *   `over-traced`  more coded as traceable than was claimed.
 */
export const CORPUS: LedgerRow[] = [
  row({
    ref: 'ibm-slack', id: 'r1', company_name: 'IBM', company_slug: 'ibm',
    headline: 'IBM reports $3.5B of productivity savings',
    claimed_amount_usd: 3_500_000_000, traceable_to_pl_usd: 0,
    destination: 1, measurement_basis: 'gross_capacity',
    cond_billing_unit_survives: false, cond_demand_sink: null, cond_permission_to_act: true,
  }),
  row({
    ref: 'wtw-propel', id: 'r2', company_name: 'Willis Towers Watson', company_slug: 'wtw',
    headline: 'WTW targets $400M of run-rate savings',
    claimed_amount_usd: 400_000_000, traceable_to_pl_usd: 350_000_000,
    destination: 5, measurement_basis: 'net_pl',
  }),
  row({
    ref: 'klarna-marketing', id: 'r3', company_name: 'Klarna', company_slug: 'klarna',
    headline: 'Klarna reports marketing savings',
    claimed_amount_usd: 28_000_000, traceable_to_pl_usd: 28_000_000,
    destination: 5, measurement_basis: 'net_pl', company_is_public: false,
  }),
  row({
    ref: 'chegg-shape', id: 'r4', company_name: 'Chegg', company_slug: 'chegg',
    headline: 'Chegg cuts operating expenses by 33%',
    claimed_amount_usd: null, claimed_value: 33, claimed_unit: 'pct',
    traceable_to_pl_usd: 23_100_000,
    destination: 5, measurement_basis: 'net_pl',
  }),
  row({
    ref: 'over-traced', id: 'r5', company_name: 'Overshoot Ltd', company_slug: 'overshoot',
    headline: 'A row coded with more traced than claimed',
    claimed_amount_usd: 100, traceable_to_pl_usd: 500,
    destination: 5,
  }),
  row({
    ref: 'atlassian-cap', id: 'r6', company_name: 'Atlassian', company_slug: 'atlassian',
    headline: 'About $2 trillion of software market capitalisation evaporates',
    claim_kind: 'counter_evidence',
    claimed_amount_usd: 2_000_000_000_000, traceable_to_pl_usd: null,
    destination: 0, measurement_basis: 'activity',
    observed_counter_move: 'Enterprise seat count declined.',
  }),
  row({
    ref: 'nanda-bpo', id: 'r7', company_name: 'MIT Project NANDA', company_slug: 'mit-nanda',
    headline: 'Only 5% of task-specific GenAI pilots reach production',
    claim_kind: 'research_finding', claimed_amount_usd: null, claimed_value: 5, claimed_unit: 'pct',
    traceable_to_pl_usd: null, destination: 0, measurement_basis: 'activity',
    group_code: 'R', company_is_public: false,
    verification_status: 'needs_primary_source',
  }),
  row({
    ref: 'cursor-unusable', id: 'r8', company_name: 'Anysphere', company_slug: 'anysphere',
    headline: 'Cursor revenue-per-employee cannot be computed',
    claim_kind: 'context', claimed_amount_usd: null, traceable_to_pl_usd: null,
    destination: 0, measurement_basis: 'unverified', company_is_public: false,
    verification_status: 'disputed',
    cond_billing_unit_survives: null, cond_demand_sink: null, cond_permission_to_act: null,
  }),
  row({
    ref: 'zendesk-price', id: 'r9', company_name: 'Zendesk', company_slug: 'zendesk',
    headline: 'Zendesk prices around $1.20 per verified resolution',
    claim_kind: 'pricing', claimed_amount_usd: null, traceable_to_pl_usd: null,
    destination: 4, measurement_basis: 'unit_economics', company_is_public: false,
  }),
  row({
    ref: 'concentrix-transfer', id: 'r10', company_name: 'A Buyer', company_slug: 'buyer',
    headline: 'A buyer takes the saving off its outsourcer',
    claimed_amount_usd: 130_000_000, traceable_to_pl_usd: 0,
    destination: 3, counterparty_absorbed: true,
    counterparty_name: 'Concentrix', counterparty_slug: 'concentrix',
    transfer_amount_usd: 130_000_000,
  }),
];

/** Quarterly operating-margin readings for a company that files. */
export const MARGIN_SERIES_FIXTURE = [
  { date: '2024-03-31', value: 0.15 },
  { date: '2024-06-30', value: 0.16 },
  { date: '2024-09-30', value: 0.17 },
  { date: '2024-12-31', value: 0.18 },
  { date: '2025-03-31', value: 0.19 },
  { date: '2025-06-30', value: 0.2 },
  { date: '2025-09-30', value: 0.21 },
  { date: '2026-03-31', value: 0.24 },
  { date: '2026-06-30', value: 0.25 },
];

export const REVENUE_SERIES_FIXTURE = [
  { date: '2024-09-30', value: 1_000_000_000 },
  { date: '2024-12-31', value: 1_100_000_000 },
  { date: '2025-03-31', value: 1_200_000_000 },
  { date: '2025-06-30', value: 1_300_000_000 },
];
