/* ===================================================================
   The shapes the database actually returns.

   Column names are `v_ledger`'s verbatim. Nothing is renamed on the way
   in, so a field on screen can be found in the schema by searching for
   the same string.
   =================================================================== */

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

export type ClaimKind = 'gain_claim' | 'counter_evidence' | 'context' | 'pricing' | 'research_finding';

export type VerificationStatus =
  | 'verified_primary'
  | 'secondary_only'
  | 'needs_primary_source'
  | 'disputed';

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

/** One reading of one series. Written only by the collector. */
export interface Observation {
  company_id: string;
  series_key: string;
  observed_at: string;
  value: number;
}

/**
 * `v_ledger` carries the company slug but not its id, and `observations`
 * carries the id but not the slug. This is the join.
 */
export interface CompanyRef {
  id: string;
  slug: string;
  cik: string | null;
  is_public: boolean;
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
  errors: Array<{ scope: string; message: string; expected?: boolean }>;
  notes: string | null;
}

/** Everything the app loads at startup, in one object. */
export interface Dataset {
  rows: LedgerRow[];
  companies: CompanyRef[];
  /** Keyed by company slug, then by series key, date-ascending. */
  series: Map<string, Map<string, Array<{ date: string; value: number }>>>;
}
