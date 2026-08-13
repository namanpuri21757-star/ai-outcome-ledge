export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** SEC requires a descriptive User-Agent with a contact email, or it returns 403. */
  SEC_USER_AGENT: string;
  /** Shared secret protecting the manual /run endpoint. */
  RUN_TOKEN: string;
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  ticker: string | null;
  cik: string | null;
  stooq_symbol: string | null;
  is_public: boolean;
}

/** One fact as returned by data.sec.gov companyfacts. */
export interface XbrlFact {
  start?: string;
  end: string;
  val: number;
  fy?: number;
  fp?: string;
  form?: string;
  accn?: string;
  filed?: string;
  frame?: string;
}

/** A fact normalised to exactly one fiscal quarter. */
export interface QuarterFact {
  end: string;
  start: string;
  val: number;
  origin: 'reported' | 'derived';
  accn?: string;
  fiscalPeriod: string;
}

export interface ObservationRow {
  company_id: string;
  series_key: string;
  observed_at: string;
  value: number;
  unit: string;
  fiscal_period?: string | null;
  source: string;
  source_ref?: string | null;
}

export interface RunError {
  scope: string;
  message: string;
}

export interface RunResult {
  job: string;
  companiesAttempted: number;
  rowsWritten: number;
  errors: RunError[];
  ok: boolean;
  notes?: string;
}
