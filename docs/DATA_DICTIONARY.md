# Data dictionary

Six tables and three views. Read `claims` first — everything else exists to support it.

---

## `companies`

One row per entity that makes or absorbs a claim. Research populations are stored here as pseudo-entities so a finding about 509 professional-services firms can sit in the same table as a finding about IBM.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `slug` | text, unique | Stable key used in URLs and joins. |
| `name` | text | |
| `ticker` | text | Null for private companies and research populations. |
| `cik` | text | **Deliberately null in the seed.** The Worker resolves it from the SEC's own ticker map and writes it back. A hand-entered wrong CIK does not error — it silently returns another company's financials. |
| `sector` | text | |
| `group_code` | text | A–J plus R, matching the taxonomy in the source research. |
| `group_label` | text | |
| `is_public` | boolean | Gates whether the collector attempts a fetch. |
| `notes` | text | |

## `claims`

The core table. One row per public claim, coded.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `ref` | text, unique | Human-readable stable key, e.g. `ibm-productivity-2024`. Makes the seed file re-runnable and lets you reference a row in conversation. |
| `company_id` | uuid → companies | |
| `claim_date` | date | When the claim was made, not the period it covers. |
| `period_label` | text | The period it covers, e.g. `FY2024`, `Q3 2025`. |
| `headline` | text | One line, as close to the source's own framing as possible. |
| `claim_detail` | text | The fuller statement. |
| `claimed_amount_usd` | numeric | Null when the claim is not denominated in money. Most claims are not. |
| `claimed_value` / `claimed_unit` | numeric / text | The native quantity: `usd`, `pct`, `fte`, `hours`, `bps`, `count`. Preserves "700 FTE" or "21.2pp" without forcing a dollar conversion. |
| `measurement_basis` | text | See METHODOLOGY §1. The most important field in the table. |
| `measurement_definition` | text | What the number actually is, in the source's terms. Null means the source never said — which is itself the finding. |
| `destination` | smallint 0–5 | See METHODOLOGY §2. |
| `destination_rationale` | text | Why that destination, from evidence. |
| `counterparty_absorbed` | boolean, **nullable** | Null means not established. Coercing this to false would assert something untrue. |
| `counterparty_id` | uuid → companies | Null when a counterparty absorbed the loss but no specific firm is identified. |
| `counterparty_note` | text | |
| `transfer_amount_usd` | numeric | The identified transfer, where one exists. |
| `traceable_to_pl_usd` | numeric, default 0 | Only moves when a named line item can be pointed at. |
| `unreconciled_usd` | generated | `claimed_amount_usd - traceable_to_pl_usd`. Computed, so it cannot drift. |
| `reconciliation_note` | text | |
| `observed_counter_move` | text | What moved the other way. Klarna's $60M saved against a service line that rose 19% lives here. |
| `cond_billing_unit_survives` | boolean, nullable | |
| `cond_demand_sink` | boolean, nullable | |
| `cond_permission_to_act` | boolean, nullable | Null on all three means uncoded, and excludes the row from the Conditions view rather than defaulting it to false. |
| `conditions_note` | text | |
| `epistemic_tag` | text | `fact` / `strong` / `inference` / `speculation` / `unknown`. |
| `evidence_tier` | smallint 1–3 | About the source, not the claim. |
| `conflict_of_interest` | boolean | Recorded, never grounds for exclusion. |
| `coi_note` | text | |
| `verification_status` | text | `verified_primary` / `secondary_only` / `needs_primary_source` / `disputed`. |
| `verify_hint` | text | The exact next step. Drives the Verification queue and its one-click EDGAR and Scholar links. |
| `source_type` | text | `sec_filing`, `earnings_call`, `peer_reviewed`, `gov_data`, `vendor`, `press`, `industry_research`. |
| `source_name` / `source_url` / `source_date` | | **`source_url` is null wherever a canonical URL was not confirmed.** A remembered URL looks verified and is worse than none. |
| `claim_kind` | text | `gain_claim` / `counter_evidence` / `context` / `pricing` / `research_finding`. Only `gain_claim` feeds money totals. |
| `status` | text | `published` / `draft`. Row-level security exposes only `published` to anonymous readers. |

## `observations`

The machine-maintained time series. Append-only in practice.

| Column | Notes |
|---|---|
| `company_id` | → companies |
| `series_key` | `revenue_q`, `operating_income_q`, `operating_margin_q`, `price_close` |
| `observed_at` | Period end for fundamentals, trade date for prices |
| `value` | numeric |
| `unit`, `source`, `source_ref`, `fetched_at` | Provenance |

Unique on `(company_id, series_key, observed_at, source)`, so re-running the collector updates rather than duplicating.

## `claim_outcomes`

Derived, and rebuilt on every run. Keyed `(claim_id, series_key)` — margin and price are separate rows.

`baseline_at/value`, `t1q_at/value`, `t4q_at/value`, `delta_1q`, `delta_4q`, `delta_1q_bps`, `delta_4q_bps`, `computed_at`.

Nothing here is hand-editable. If a number looks wrong, the fix belongs in the collector.

## `fetch_runs`

Every collector run: `job`, `status`, `started_at`, `finished_at`, `rows_written`, `error`. This is the visible failure path — the health strip in the app reads it and turns amber after two days without a clean run, so a silently dead pipeline surfaces in the interface.

## `claim_submissions`

The public inlet. Anonymous users can insert; nobody but the service role can read it back. Promotion into `claims` stays manual, because the coding is the value and cannot be inferred from a headline.

---

## Views

**`v_ledger`** — one denormalised row per claim with company, counterparty, and outcome columns joined. This is what the frontend reads; the app issues one query.

**`v_reconciliation`** — claimed, traced, unreconciled and transferred, grouped by destination, `gain_claim` only.

**`v_condition_cells`** — the 2×2×2 with claim count, distinct company count, and mean four-quarter margin delta. Rows with any condition null are excluded.

All three are `security_invoker = on`, so row-level security applies to the caller rather than the view owner.

---

## Adding a claim

Append to `supabase/04_seed_claims.sql` and re-run it, or insert directly. The `ref` must be unique; the file is written as an upsert so re-running is safe.

```sql
insert into claims (ref, company_id, claim_date, period_label, headline, claim_detail,
                    claimed_amount_usd, claimed_value, claimed_unit,
                    measurement_basis, measurement_definition,
                    destination, destination_rationale,
                    traceable_to_pl_usd, reconciliation_note, observed_counter_move,
                    epistemic_tag, evidence_tier, conflict_of_interest,
                    verification_status, verify_hint,
                    source_type, source_name, source_url, source_date, claim_kind, status)
select 'acme-support-2026',
       id, '2026-03-14', 'FY2025',
       'Acme reports $40M saved in support operations',
       'Full statement as the source put it.',
       40000000, 40, 'usd',
       'gross_capacity', 'Avoided agent hours valued at fully loaded cost.',
       1, 'Headcount flat; no cost line identified as having moved.',
       0, 'No line item disclosed.',
       'Support and operations expense rose 6% in the same period.',
       'fact', 3, false,
       'needs_primary_source', 'Confirm against the FY2025 10-K MD&A, not the press release.',
       'press', 'Reuters', null, '2026-03-14', 'gain_claim', 'published'
from companies where slug = 'acme';
```

Four things to get right, in order of how often they go wrong:

1. **`measurement_basis` before `destination`.** If you cannot say what was measured, you cannot say where it went. Leave destination at 0.
2. **`traceable_to_pl_usd` stays 0** unless you can name the line item. This is the discipline the whole reconciliation depends on.
3. **`source_url` stays null** unless you opened it. Put the next step in `verify_hint` instead.
4. **Use `claim_kind` honestly.** A market-cap figure or a utilisation statistic is `context`, not a `gain_claim`, and putting it in the wrong bucket corrupts the headline arithmetic.

If a claim contradicts one already in the table, add it as `counter_evidence` against the same company rather than editing the original.
