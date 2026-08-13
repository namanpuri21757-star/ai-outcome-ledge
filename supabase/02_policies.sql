-- =====================================================================
-- AI OUTCOME LEDGER — row level security
-- Run this SECOND.
--
-- The model:
--   anon (the browser)  -> can READ everything published. Can INSERT a
--                          submission. Cannot read submissions back,
--                          cannot write anywhere else.
--   service_role (Worker) -> bypasses RLS entirely. This key never leaves
--                          the Cloudflare secret store.
-- =====================================================================

alter table companies         enable row level security;
alter table claims            enable row level security;
alter table observations      enable row level security;
alter table claim_outcomes    enable row level security;
alter table fetch_runs        enable row level security;
alter table claim_submissions enable row level security;

-- Drop-then-create so this file is re-runnable.
drop policy if exists companies_read      on companies;
drop policy if exists claims_read         on claims;
drop policy if exists observations_read   on observations;
drop policy if exists outcomes_read       on claim_outcomes;
drop policy if exists fetch_runs_read     on fetch_runs;
drop policy if exists submissions_insert  on claim_submissions;

create policy companies_read on companies
  for select to anon, authenticated using (true);

create policy claims_read on claims
  for select to anon, authenticated using (status = 'published');

create policy observations_read on observations
  for select to anon, authenticated using (true);

create policy outcomes_read on claim_outcomes
  for select to anon, authenticated using (true);

-- The health strip on the front end reads this. It is how you find out
-- the pipeline died without having to go looking.
create policy fetch_runs_read on fetch_runs
  for select to anon, authenticated using (true);

create policy submissions_insert on claim_submissions
  for insert to anon, authenticated with check (true);
-- deliberately NO select policy on claim_submissions:
-- the public can post, only you (service_role / SQL editor) can read.

-- Views inherit RLS from their base tables under `security_invoker`.
alter view v_ledger          set (security_invoker = on);
alter view v_reconciliation  set (security_invoker = on);
alter view v_condition_cells set (security_invoker = on);

grant select on v_ledger, v_reconciliation, v_condition_cells to anon, authenticated;
