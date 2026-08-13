-- =====================================================================
-- AI OUTCOME LEDGER — schema
-- Run this FIRST, in the Supabase SQL editor.
-- Safe to re-run: everything is IF NOT EXISTS / CREATE OR REPLACE.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Controlled vocabularies.
-- These are enforced by CHECK constraints rather than enums so that you
-- can add a value later with one ALTER instead of a type migration.
-- ---------------------------------------------------------------------

-- measurement_basis: what the claimed number actually is.
--   gross_capacity  hours/heads freed, valued at loaded cost. Not a cost line.
--   net_pl          a P&L line item that moved, or an audited saving.
--   unit_economics  a per-unit price or margin (e.g. $/resolution).
--   headcount       a change in people.
--   time            hours or latency saved, not valued in dollars.
--   quality         satisfaction, burnout, error rate.
--   activity        usage/volume counts (users, tickets, chats).
--   unverified      the source does not define what was measured.

-- destination: where the gain landed. Numbering follows the five
-- destinations in "Who Is Actually Implementing AI" Part 0.
--   1 worker_slack      absorbed as slack; nothing changes financially
--   2 quality           converted to quality/wellbeing, no financial trace
--   3 counterparty      transferred off a supplier's revenue line
--   4 price             passed to the customer through price
--   5 margin            retained as margin
--   0 unknown           not yet coded

create table if not exists companies (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  ticker        text,                       -- for Stooq, US listings only
  cik           text,                       -- 10-digit zero-padded, for SEC XBRL
  stooq_symbol  text,                       -- e.g. 'ibm.us'; null = no price series
  sector        text,
  group_code    text,                       -- A..J taxonomy from the source research
  group_label   text,
  is_public     boolean not null default false,
  hq_country    text,
  notes         text,
  created_at    timestamptz not null default now()
);

comment on column companies.group_code is
  'A AI-native greenfield / B AI-native rollup / C platform vendor dogfooding / D large incumbent / E legacy prof services / F BPO counterparty / G healthcare delivery / H manufacturing / I small business / J disrupted / R research population';

create table if not exists claims (
  id                     uuid primary key default gen_random_uuid(),
  ref                    text not null unique,   -- stable human key, e.g. 'ibm-3.5b-productivity-2024'
  company_id             uuid not null references companies(id) on delete cascade,
  claim_date             date not null,
  period_label           text,                     -- 'Q3 2025', 'FY2024'
  headline               text not null,            -- one line, the claim as asserted
  claim_detail           text,                     -- paraphrase, never a long quote
  claimed_amount_usd     numeric,                  -- null when the claim is not in dollars
  claimed_unit           text,                     -- 'usd', 'pct', 'hours', 'fte', 'bps', 'ratio'
  claimed_value          numeric,                  -- the number in its native unit
  measurement_basis      text not null default 'unverified'
                         check (measurement_basis in ('gross_capacity','net_pl','unit_economics',
                                                      'headcount','time','quality','activity','unverified')),
  measurement_definition text,                     -- how the source defines the number. The whole point.
  destination            smallint not null default 0 check (destination between 0 and 5),
  destination_rationale  text,

  -- counterparty: whose revenue line paid for this "saving"
  -- nullable on purpose: 'not established' is a real and common state, and
  -- coercing it to false would quietly assert that no counterparty absorbed it.
  counterparty_absorbed  boolean default false,
  counterparty_id        uuid references companies(id),
  counterparty_note      text,
  transfer_amount_usd    numeric,

  -- reconciliation: how much of the claim can be traced to a disclosed P&L line
  traceable_to_pl_usd    numeric,
  reconciliation_note    text,

  -- what happened to the line the claim should have moved
  observed_counter_move  text,                     -- e.g. 'CS cost rose 19% YoY in the same quarter'

  -- the three conditions (Part III of the source research)
  cond_billing_unit_survives boolean,
  cond_demand_sink           boolean,
  cond_permission_to_act     boolean,
  conditions_note            text,

  -- epistemics
  epistemic_tag       text not null default 'unknown'
                      check (epistemic_tag in ('fact','strong','inference','speculation','unknown')),
  evidence_tier       smallint not null default 3 check (evidence_tier between 1 and 3),
  conflict_of_interest boolean not null default false,
  coi_note            text,
  verification_status text not null default 'needs_primary_source'
                      check (verification_status in ('verified_primary','secondary_only','needs_primary_source','disputed')),
  verify_hint         text,                        -- exact next step to verify. Your work queue.

  source_type   text,   -- 'sec_filing','earnings_call','press_release','peer_reviewed','vendor_report','industry_survey','press','interview'
  source_name   text,
  source_url    text,
  source_date   date,

  -- What KIND of row this is. Without this, a $2T market-capitalisation
  -- figure and a $60M savings claim end up in the same total and the
  -- headline reconciliation number becomes meaningless.
  claim_kind    text not null default 'gain_claim'
                check (claim_kind in ('gain_claim','counter_evidence','context','pricing','research_finding')),

  status        text not null default 'published' check (status in ('published','draft','retracted')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column claims.evidence_tier is
  '1 = primary (filing, administrative data, peer review). 2 = vendor- or self-originated. 3 = press or secondary.';

create index if not exists claims_company_idx      on claims(company_id);
create index if not exists claims_date_idx         on claims(claim_date);
create index if not exists claims_destination_idx  on claims(destination);
create index if not exists claims_basis_idx        on claims(measurement_basis);
create index if not exists claims_counterparty_idx on claims(counterparty_id);
create index if not exists claims_kind_idx         on claims(claim_kind);

-- ---------------------------------------------------------------------
-- observations: the machine-maintained half of the ledger.
-- One row per (company, series, date, source). Written only by the Worker.
-- ---------------------------------------------------------------------
create table if not exists observations (
  id            bigserial primary key,
  company_id    uuid not null references companies(id) on delete cascade,
  series_key    text not null,
  observed_at   date not null,        -- period END for fundamentals, trade date for prices
  value         numeric not null,
  unit          text not null default 'usd',
  fiscal_period text,                 -- 'CY2025Q3'
  source        text not null,        -- 'sec_xbrl' | 'stooq'
  source_ref    text,                 -- accession number, or fetch url
  fetched_at    timestamptz not null default now(),
  unique (company_id, series_key, observed_at, source)
);

comment on column observations.series_key is
  'revenue_q | operating_income_q | operating_margin_q | opex_q | cost_of_revenue_q | rnd_q | net_income_q | gross_margin_q | price_close';

create index if not exists obs_lookup_idx on observations(company_id, series_key, observed_at);

-- ---------------------------------------------------------------------
-- claim_outcomes: derived. "What happened to margin afterward", computed
-- from observations rather than typed by hand. Rewritten every run.
-- ---------------------------------------------------------------------
create table if not exists claim_outcomes (
  claim_id        uuid not null references claims(id) on delete cascade,
  series_key      text not null,
  baseline_at     date,
  baseline_value  numeric,
  t1q_at          date,
  t1q_value       numeric,
  t4q_at          date,
  t4q_value       numeric,
  delta_1q        numeric,   -- absolute change in the series' own unit
  delta_4q        numeric,
  delta_1q_bps    numeric,   -- margin series only: change in basis points
  delta_4q_bps    numeric,
  computed_at     timestamptz not null default now(),
  primary key (claim_id, series_key)
);

-- ---------------------------------------------------------------------
-- fetch_runs: a visible failure path. Every scheduled run lands here,
-- successful or not, so a silent breakage is impossible to miss.
-- ---------------------------------------------------------------------
create table if not exists fetch_runs (
  id           bigserial primary key,
  trigger      text not null,          -- cron expression or 'manual'
  job          text not null,          -- 'fundamentals' | 'prices' | 'outcomes' | 'all'
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean,
  companies_attempted int default 0,
  rows_written        int default 0,
  errors       jsonb  default '[]'::jsonb,
  notes        text
);

create index if not exists fetch_runs_started_idx on fetch_runs(started_at desc);

-- ---------------------------------------------------------------------
-- claim_submissions: the public "living record" inbox. Anyone can insert,
-- nobody can read but you. Promote into claims by hand after checking.
-- ---------------------------------------------------------------------
create table if not exists claim_submissions (
  id           uuid primary key default gen_random_uuid(),
  company_name text not null,
  headline     text not null,
  claim_detail text,
  source_url   text,
  claim_date   date,
  submitter    text,
  reviewed     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Views the frontend reads. Keeping the joins in SQL means the client
-- ships less logic and the numbers are the same everywhere.
-- ---------------------------------------------------------------------
create or replace view v_ledger as
select
  c.id,
  c.ref,
  c.claim_date,
  c.period_label,
  c.headline,
  c.claim_detail,
  c.claim_kind,
  c.claimed_amount_usd,
  c.claimed_value,
  c.claimed_unit,
  c.measurement_basis,
  c.measurement_definition,
  c.destination,
  c.destination_rationale,
  c.counterparty_absorbed,
  c.counterparty_note,
  c.transfer_amount_usd,
  c.traceable_to_pl_usd,
  coalesce(c.claimed_amount_usd, 0) - coalesce(c.traceable_to_pl_usd, 0) as unreconciled_usd,
  c.reconciliation_note,
  c.observed_counter_move,
  c.cond_billing_unit_survives,
  c.cond_demand_sink,
  c.cond_permission_to_act,
  c.conditions_note,
  c.epistemic_tag,
  c.evidence_tier,
  c.conflict_of_interest,
  c.coi_note,
  c.verification_status,
  c.verify_hint,
  c.source_type, c.source_name, c.source_url, c.source_date,
  c.status,
  co.name        as company_name,
  co.slug        as company_slug,
  co.ticker      as company_ticker,
  co.sector      as sector,
  co.group_code  as group_code,
  co.group_label as group_label,
  co.is_public   as company_is_public,
  cp.name        as counterparty_name,
  cp.slug        as counterparty_slug,
  om.delta_1q_bps as margin_delta_1q_bps,
  om.delta_4q_bps as margin_delta_4q_bps,
  om.baseline_value as margin_baseline,
  om.t4q_value      as margin_t4q,
  pr.delta_4q       as price_delta_4q
from claims c
join companies co on co.id = c.company_id
left join companies cp on cp.id = c.counterparty_id
left join claim_outcomes om on om.claim_id = c.id and om.series_key = 'operating_margin_q'
left join claim_outcomes pr on pr.claim_id = c.id and pr.series_key = 'price_close'
where c.status = 'published';

create or replace view v_reconciliation as
select
  destination,
  count(*)                                   as claims,
  sum(coalesce(claimed_amount_usd, 0))       as claimed_usd,
  sum(coalesce(traceable_to_pl_usd, 0))      as traced_usd,
  sum(coalesce(claimed_amount_usd, 0) - coalesce(traceable_to_pl_usd, 0)) as unreconciled_usd,
  sum(coalesce(transfer_amount_usd, 0))      as transferred_usd
from claims
where status = 'published'
  and claim_kind = 'gain_claim'   -- context and counter-evidence rows are
                                  -- excluded so the totals mean one thing
group by destination
order by destination;

create or replace view v_condition_cells as
select
  cond_billing_unit_survives as billing_unit_survives,
  cond_demand_sink           as demand_sink,
  cond_permission_to_act     as permission_to_act,
  count(*)                   as claims,
  count(distinct company_id) as companies,
  avg(o.delta_4q_bps)        as mean_margin_delta_4q_bps
from claims c
left join claim_outcomes o on o.claim_id = c.id and o.series_key = 'operating_margin_q'
where c.status = 'published'
  and cond_billing_unit_survives is not null
  and cond_demand_sink is not null
  and cond_permission_to_act is not null
group by 1,2,3;

-- keep updated_at honest
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists claims_touch on claims;
create trigger claims_touch before update on claims
for each row execute function touch_updated_at();
