export type MeasurementBasis =
  | 'gross_capacity'
  | 'net_pl'
  | 'unit_economics'
  | 'headcount'
  | 'time'
  | 'quality'
  | 'activity'
  | 'unverified';

export type EpistemicTag = 'fact' | 'strong' | 'inference' | 'speculation' | 'unknown';

export type ClaimKind =
  | 'gain_claim'
  | 'counter_evidence'
  | 'context'
  | 'pricing'
  | 'research_finding';

export type VerificationStatus =
  | 'verified_primary'
  | 'secondary_only'
  | 'needs_primary_source'
  | 'disputed';

/** One row of v_ledger. Column names are the view's, verbatim. */
export interface LedgerRow {
  id: string;
  ref: string;
  claim_date: string;
  period_label: string | null;
  headline: string;
  claim_detail: string | null;
  claim_kind: ClaimKind;
  claimed_amount_usd: number | null;
  claimed_value: number | null;
  claimed_unit: string | null;
  measurement_basis: MeasurementBasis;
  measurement_definition: string | null;
  destination: number;
  destination_rationale: string | null;
  counterparty_absorbed: boolean | null;
  counterparty_note: string | null;
  transfer_amount_usd: number | null;
  traceable_to_pl_usd: number | null;
  unreconciled_usd: number | null;
  reconciliation_note: string | null;
  observed_counter_move: string | null;
  cond_billing_unit_survives: boolean | null;
  cond_demand_sink: boolean | null;
  cond_permission_to_act: boolean | null;
  conditions_note: string | null;
  epistemic_tag: EpistemicTag;
  evidence_tier: number;
  conflict_of_interest: boolean;
  coi_note: string | null;
  verification_status: VerificationStatus;
  verify_hint: string | null;
  source_type: string | null;
  source_name: string | null;
  source_url: string | null;
  source_date: string | null;
  company_name: string;
  company_slug: string;
  company_ticker: string | null;
  sector: string | null;
  group_code: string | null;
  group_label: string | null;
  company_is_public: boolean;
  counterparty_name: string | null;
  counterparty_slug: string | null;
  margin_delta_1q_bps: number | null;
  margin_delta_4q_bps: number | null;
  margin_baseline: number | null;
  margin_t4q: number | null;
  price_delta_4q: number | null;
}

export interface Observation {
  company_id: string;
  series_key: string;
  observed_at: string;
  value: number;
  unit: string;
  fiscal_period: string | null;
}

export interface FetchRun {
  id: number;
  trigger: string;
  job: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  companies_attempted: number;
  rows_written: number;
  /** `expected` marks a permanent fact about a company — a non-SEC filer
   *  with no possible margin series — rather than a fault in the run. */
  errors: Array<{ scope: string; message: string; expected?: boolean }>;
  notes: string | null;
}
