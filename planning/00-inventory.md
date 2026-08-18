# 00 — Inventory of what exists

Pre-flight for the Threshold Ledger repurpose, per `planning/requirements.md` §0.
Everything below is read out of the source in this repository at commit `c1d6202`
on 2026-08-17. Nothing here is a proposal and nothing here is remembered from
`CLAUDE.md` — where `CLAUDE.md` or `requirements.md` disagrees with the code, the
code is recorded and the disagreement is listed in §5.

Line citations are `path:line`.

---

## 1. Supabase schema

One file defines the whole schema: `supabase/01_schema.sql`. Policies are in
`supabase/02_policies.sql`. There is no migrations directory — the schema is a
single re-runnable script (`01_schema.sql:4`, everything is `if not exists` /
`create or replace`).

`create extension if not exists "pgcrypto"` — `01_schema.sql:7`.

### 1.1 `companies` — `01_schema.sql:34-48`

| Column | Type | Constraint / default | Line |
|---|---|---|---|
| `id` | uuid | primary key default `gen_random_uuid()` | 35 |
| `slug` | text | not null **unique** | 36 |
| `name` | text | not null | 37 |
| `ticker` | text | — (comment: for Stooq, US listings only) | 38 |
| `cik` | text | — (comment: 10-digit zero-padded, for SEC XBRL) | 39 |
| `stooq_symbol` | text | — (`null` = no price series) | 40 |
| `sector` | text | — | 41 |
| `group_code` | text | — (A..J taxonomy) | 42 |
| `group_label` | text | — | 43 |
| `is_public` | boolean | not null default `false` | 44 |
| `hq_country` | text | — | 45 |
| `notes` | text | — | 46 |
| `created_at` | timestamptz | not null default `now()` | 47 |

Column comment, `01_schema.sql:50-51`:

```
'A AI-native greenfield / B AI-native rollup / C platform vendor dogfooding / D large incumbent / E legacy prof services / F BPO counterparty / G healthcare delivery / H manufacturing / I small business / J disrupted / R research population'
```

No CHECK constraints on this table. `group_code` is free text carrying a
documented vocabulary — the vocabulary lives only in the comment.

### 1.2 `claims` — `01_schema.sql:53-116`

| Column | Type | Constraint / default | Line |
|---|---|---|---|
| `id` | uuid | primary key default `gen_random_uuid()` | 54 |
| `ref` | text | not null **unique** (stable human key) | 55 |
| `company_id` | uuid | not null references `companies(id)` on delete cascade | 56 |
| `claim_date` | date | not null | 57 |
| `period_label` | text | — | 58 |
| `headline` | text | not null | 59 |
| `claim_detail` | text | — | 60 |
| `claimed_amount_usd` | numeric | — (`null` when the claim is not in dollars) | 61 |
| `claimed_unit` | text | — (`'usd','pct','hours','fte','bps','ratio'`, uncontrolled) | 62 |
| `claimed_value` | numeric | — | 63 |
| `measurement_basis` | text | not null default `'unverified'` + CHECK | 64-66 |
| `measurement_definition` | text | — | 67 |
| `destination` | smallint | not null default `0` + CHECK | 68 |
| `destination_rationale` | text | — | 69 |
| `counterparty_absorbed` | boolean | default `false` (nullable on purpose, 71-73) | 74 |
| `counterparty_id` | uuid | references `companies(id)` | 75 |
| `counterparty_note` | text | — | 76 |
| `transfer_amount_usd` | numeric | — | 77 |
| `traceable_to_pl_usd` | numeric | — | 80 |
| `reconciliation_note` | text | — | 81 |
| `observed_counter_move` | text | — | 84 |
| `cond_billing_unit_survives` | boolean | — | 87 |
| `cond_demand_sink` | boolean | — | 88 |
| `cond_permission_to_act` | boolean | — | 89 |
| `conditions_note` | text | — | 90 |
| `epistemic_tag` | text | not null default `'unknown'` + CHECK | 93-94 |
| `evidence_tier` | smallint | not null default `3` + CHECK | 95 |
| `conflict_of_interest` | boolean | not null default `false` | 96 |
| `coi_note` | text | — | 97 |
| `verification_status` | text | not null default `'needs_primary_source'` + CHECK | 98-99 |
| `verify_hint` | text | — (the work queue) | 100 |
| `source_type` | text | — (vocabulary in comment only, 102) | 102 |
| `source_name` | text | — | 103 |
| `source_url` | text | — | 104 |
| `source_date` | date | — | 105 |
| `claim_kind` | text | not null default `'gain_claim'` + CHECK | 110-111 |
| `status` | text | not null default `'published'` + CHECK | 113 |
| `created_at` | timestamptz | not null default `now()` | 114 |
| `updated_at` | timestamptz | not null default `now()` | 115 |

Column comment, `01_schema.sql:118-119`:

```
'1 = primary (filing, administrative data, peer review). 2 = vendor- or self-originated. 3 = press or secondary.'
```

Indexes — `01_schema.sql:121-126`: `claims_company_idx(company_id)`,
`claims_date_idx(claim_date)`, `claims_destination_idx(destination)`,
`claims_basis_idx(measurement_basis)`,
`claims_counterparty_idx(counterparty_id)`, `claims_kind_idx(claim_kind)`.

### 1.3 Every CHECK constraint, verbatim

There are six, all on `claims`. This is the whole controlled-vocabulary surface
of the database.

```sql
-- 01_schema.sql:64-66
  measurement_basis      text not null default 'unverified'
                         check (measurement_basis in ('gross_capacity','net_pl','unit_economics',
                                                      'headcount','time','quality','activity','unverified')),
```

```sql
-- 01_schema.sql:68
  destination            smallint not null default 0 check (destination between 0 and 5),
```

```sql
-- 01_schema.sql:93-94
  epistemic_tag       text not null default 'unknown'
                      check (epistemic_tag in ('fact','strong','inference','speculation','unknown')),
```

```sql
-- 01_schema.sql:95
  evidence_tier       smallint not null default 3 check (evidence_tier between 1 and 3),
```

```sql
-- 01_schema.sql:98-99
  verification_status text not null default 'needs_primary_source'
                      check (verification_status in ('verified_primary','secondary_only','needs_primary_source','disputed')),
```

```sql
-- 01_schema.sql:110-111
  claim_kind    text not null default 'gain_claim'
                check (claim_kind in ('gain_claim','counter_evidence','context','pricing','research_finding')),
```

```sql
-- 01_schema.sql:113
  status        text not null default 'published' check (status in ('published','draft','retracted')),
```

The stated reason for CHECK over enum is at `01_schema.sql:9-13`: *"These are
enforced by CHECK constraints rather than enums so that you can add a value later
with one ALTER instead of a type migration."* Two vocabularies (`destination`,
`evidence_tier`) are numeric ranges rather than value lists, so adding a value
means widening a `between`, and the human-readable names for `destination` live
only in a SQL comment (`01_schema.sql:25-32`) and in the frontend's
`labels.ts` — not in the database.

### 1.4 `observations` — `01_schema.sql:132-144`

| Column | Type | Constraint / default | Line |
|---|---|---|---|
| `id` | bigserial | primary key | 133 |
| `company_id` | uuid | not null references `companies(id)` on delete cascade | 134 |
| `series_key` | text | not null | 135 |
| `observed_at` | date | not null (period END for fundamentals, trade date for prices) | 136 |
| `value` | numeric | not null | 137 |
| `unit` | text | not null default `'usd'` | 138 |
| `fiscal_period` | text | — (`'CY2025Q3'`) | 139 |
| `source` | text | not null (`'sec_xbrl'` \| `'stooq'`) | 140 |
| `source_ref` | text | — (accession number, or fetch url) | 141 |
| `fetched_at` | timestamptz | not null default `now()` | 142 |

`unique (company_id, series_key, observed_at, source)` — `01_schema.sql:143`.
This tuple is the upsert conflict target the Worker uses
(`worker/src/index.ts:10`).

Comment, `01_schema.sql:146-147`:

```
'revenue_q | operating_income_q | operating_margin_q | opex_q | cost_of_revenue_q | rnd_q | net_income_q | gross_margin_q | price_close'
```

`series_key` is **not** CHECK-constrained. Index `obs_lookup_idx(company_id,
series_key, observed_at)` — `01_schema.sql:149`.

### 1.5 `claim_outcomes` — `01_schema.sql:155-170`

Derived, "rewritten every run" (`01_schema.sql:152-153`).

| Column | Type | Line |
|---|---|---|
| `claim_id` | uuid not null references `claims(id)` on delete cascade | 156 |
| `series_key` | text not null | 157 |
| `baseline_at` | date | 158 |
| `baseline_value` | numeric | 159 |
| `t1q_at` | date | 160 |
| `t1q_value` | numeric | 161 |
| `t4q_at` | date | 162 |
| `t4q_value` | numeric | 163 |
| `delta_1q` | numeric (absolute change in the series' own unit) | 164 |
| `delta_4q` | numeric | 165 |
| `delta_1q_bps` | numeric (margin series only) | 166 |
| `delta_4q_bps` | numeric | 167 |
| `computed_at` | timestamptz not null default `now()` | 168 |

Primary key `(claim_id, series_key)` — `01_schema.sql:169`. No CHECK
constraints. **There is no column recording why a row is absent** — the Worker
writes no row at all when a claim cannot be measured, which is why the browser
recomputes the reason (see §4.4).

### 1.6 `fetch_runs` — `01_schema.sql:176-187`

| Column | Type | Line |
|---|---|---|
| `id` | bigserial primary key | 177 |
| `trigger` | text not null (cron expression or `'manual'`) | 178 |
| `job` | text not null (`'fundamentals'`\|`'prices'`\|`'outcomes'`\|`'all'`) | 179 |
| `started_at` | timestamptz not null default `now()` | 180 |
| `finished_at` | timestamptz | 181 |
| `ok` | boolean | 182 |
| `companies_attempted` | int default `0` | 183 |
| `rows_written` | int default `0` | 184 |
| `errors` | jsonb default `'[]'::jsonb` | 185 |
| `notes` | text | 186 |

Index `fetch_runs_started_idx(started_at desc)` — `01_schema.sql:189`. `job` is
not CHECK-constrained despite the documented four values.

### 1.7 `claim_submissions` — `01_schema.sql:195-205`

| Column | Type | Line |
|---|---|---|
| `id` | uuid primary key default `gen_random_uuid()` | 196 |
| `company_name` | text not null | 197 |
| `headline` | text not null | 198 |
| `claim_detail` | text | 199 |
| `source_url` | text | 200 |
| `claim_date` | date | 201 |
| `submitter` | text | 202 |
| `reviewed` | boolean not null default `false` | 203 |
| `created_at` | timestamptz not null default `now()` | 204 |

"Anyone can insert, nobody can read but you" — `01_schema.sql:192-193`.

### 1.8 Views

- **`v_ledger`** — `01_schema.sql:211-265`. `claims` joined to `companies`
  (as company and again as counterparty), plus two `claim_outcomes` left joins
  pinned to `series_key = 'operating_margin_q'` (263) and `'price_close'` (264).
  Filters `where c.status = 'published'` (265). Adds one computed column:
  `coalesce(claimed_amount_usd,0) - coalesce(traceable_to_pl_usd,0) as
  unreconciled_usd` (231). This is the view the frontend reads.
- **`v_reconciliation`** — `01_schema.sql:267-280`. Per-destination sums,
  `where status = 'published' and claim_kind = 'gain_claim'` (276-278).
- **`v_condition_cells`** — `01_schema.sql:282-296`. The three-condition truth
  table with mean margin delta.

Trigger: `touch_updated_at()` before update on `claims` — `01_schema.sql:299-307`.

### 1.9 Row-level security — `supabase/02_policies.sql`

RLS enabled on all six tables (13-18). Policies:

| Policy | Table | Grant | Line |
|---|---|---|---|
| `companies_read` | companies | select to anon, authenticated `using (true)` | 28-29 |
| `claims_read` | claims | select `using (status = 'published')` | 31-32 |
| `observations_read` | observations | select `using (true)` | 34-35 |
| `outcomes_read` | claim_outcomes | select `using (true)` | 37-38 |
| `fetch_runs_read` | fetch_runs | select `using (true)` | 42-43 |
| `submissions_insert` | claim_submissions | **insert only** `with check (true)` | 45-46 |

There is deliberately **no select policy on `claim_submissions`** (47-48). All
three views are `security_invoker = on` (51-53) and granted select to anon and
authenticated (55). `service_role` (the Worker) bypasses RLS entirely (8-10).

### 1.10 Seed data actually in the repo

- `supabase/03_seed_companies.sql` — one `insert into companies` statement
  (line 11) with **45** value rows.
- `supabase/04_seed_claims.sql` — 84 value rows, plus a second `insert into
  claims` at line 865.

All five `claim_kind` values appear in the seed. Row counts in the live database
were not verified — see §5.

---

## 2. Routes and page components

Hash routing, hand-rolled in `web/src/lib/route.ts`. No router library.

`ViewName` is a closed union of nine — `route.ts:43-45`; `KNOWN` repeats the same
nine at `route.ts:47-49`. An unknown hash returns `LEDGER` (`route.ts:119`).

| Hash | View name | Component | Renders | Line |
|---|---|---|---|---|
| *(bare, `''` or `'#'`)* | `home` | `views/HomeView.tsx:51` | Landing page: headline, one example claim row, two calls to action. Outside the shell. | `route.ts:109-111`, `App.tsx:103` |
| `#/home` | `home` | same | Same page, named so it can be linked | `route.ts:24-25` |
| `#/thesis` | `thesis` | `views/ThesisView.tsx:83` | The blueprint: four stages of a claimed dollar, on a drafting sheet, with a readout | `App.tsx:95` |
| `#/directory` | `directory` | `views/DirectoryView.tsx:39` | One card per company, largest claim first | `App.tsx:100-102` |
| `#/prices` | `prices` | `views/PricesView.tsx:39` | Published list prices, hardcoded. **Not handed `data`** | `App.tsx:99` |
| `#/` | `ledger` | `views/LedgerView.tsx:39` | The finding, the destination breakdown, the readout, every row, the filters | `App.tsx:153-162` |
| `#/claim/<ref>` | `claim` | `views/ClaimView.tsx:34` | One claim fully unpacked; the only place a row is shown whole | `App.tsx:164-171` |
| `#/company/<slug>` | `company` | `views/CompanyView.tsx:31` | One company's record with a generated verdict | `App.tsx:173-181` |
| `#/method` | `method` | `views/MethodView.tsx:14` | How a row is coded; renders the glossary | `App.tsx:183` |
| `#/maintenance` | `maintenance` | `views/MaintenanceView.tsx:26` | Collector health, checking queue, submission form | `App.tsx:185-187` |

Route mechanics worth carrying forward:

- **Covers render outside the shell.** `COVER_VIEWS = ['home','thesis',
  'directory','prices']` (`route.ts:52`), `isCover()` (`route.ts:54`), and
  `App.tsx:94-104` returns them before the `.shell` markup — no masthead, no
  footer, own top bar (`components/CoverBar.tsx:14`).
- **The bare root is the landing page and `#/` is the ledger**, distinguished by
  one character read before the slash is stripped (`route.ts:107-111`).
- **Filters are serialised on `#/` only.** `FILTERED_VIEW = 'ledger'`
  (`route.ts:60`); `toHash` only serialises when `route.view === FILTERED_VIEW`
  (`route.ts:134`); `parseHash` returns `EMPTY_FILTERS` for every other view even
  if the URL carries parameters by hand (`route.ts:128`).
- Filter query keys: `q`, `kind`, `basis`, `dest`, `check`, `type`, `co`,
  `dollars` — `route.ts:82-90` (parse) and `94-103` (serialise, non-defaults
  only).
- `WITH_ID = ['claim','company']` (`route.ts:57`); a drill-down with no
  identifier falls back to the ledger (`route.ts:123`).
- Navigation dispatches a synthetic `hashchange` when the hash is unchanged
  (`route.ts:148-152`).

Top-level nav is three items — `web/src/lib/labels.ts:310-314`:
`{ledger: 'The ledger'}`, `{method: 'Method'}`, `{maintenance: 'Maintenance'}`.
The cover bar reads the same `NAV` list (`CoverBar.tsx:14`).

### 2.1 Shared components

| Component | File:line | Role |
|---|---|---|
| `ClaimRow` / `CompanyRow` | `components/ClaimRow.tsx:27`, `:94` | One row in the ledger list |
| `CoverBar` | `components/CoverBar.tsx:14` | The single top bar all four covers share |
| `FilterPanel` | `components/FilterPanel.tsx:33` | Chips, search, CSV export |
| `GapBar` / `GapKey` | `components/GapBar.tsx:27`, `:74` | The signature element and its legend |
| `MarginWindow` / `MarginLine` | `components/MarginWindow.tsx:26`, `:136` | The three-reading margin window |
| `PriceChart` | `components/PriceChart.tsx:48` | Hand-rolled SVG, price page only |
| `Term` / `TermSet` | `components/Term.tsx:35`, `:87` | In-flow definition expander |

Vendored, all requiring `motion`: `vendor/reactbits/BlurText.tsx`,
`CountUp.tsx`, `Waves.tsx`.

### 2.2 What the browser reads at runtime

`web/src/lib/supabase.ts:83-107` — three parallel reads:

- `v_ledger` — `select('*')`, ordered `claim_date` descending (87-89).
- `companies` — `select('id,slug,cik,is_public')`, ordered by slug (92-95).
- `observations` — `select('company_id,series_key,observed_at,value')`, filtered
  `.in('series_key', SERIES_IN_USE)` (98-103). `SERIES_IN_USE` is the margin and
  revenue series only (`supabase.ts:80-81`) — "Anything else is collected but
  unused."

`fetch_runs` is read separately (`supabase.ts:146`) and its failure must not stop
the ledger rendering (`App.tsx:71-74`).

All reads go through `fetchAll`, which pages with an explicit Range header until
a page comes back short (`supabase.ts:59`, and the reason at `supabase.ts:26`).

---

## 3. Design-token extraction

Read from `web/src/styles.css` unless stated. This is the constraint §0 of the
requirements calls the one that matters most, so literals used outside the token
set are listed too, not just the custom properties.

### 3.1 Color — the paper palette, `:root`

| Token | Value | Line |
|---|---|---|
| `--paper` | `#edf0f3` | 20 |
| `--paper-raised` | `#f7f9fa` | 21 |
| `--paper-sunk` | `#e2e7ec` | 22 |
| `--paper-deep` | `#d7dee4` | 23 |
| `--ink` | `#111a22` | 25 |
| `--ink-2` | `#46555f` | 26 |
| `--ink-3` | `#6b7a86` | 27 |
| `--rule` | `#c9d2d9` | 29 |
| `--rule-strong` | `#a5b3bd` | 30 |
| `--traced` | `#146b52` | 32 |
| `--claimed` | `#2c5c8c` | 33 |
| `--gap` | `#a8391f` | 34 |
| `--transfer` | `#8a6420` | 35 |
| `--quality` | `#5b4a86` | 36 |

`color-scheme: light` — line 69. There is no dark-mode media query anywhere in
the file; the dark surfaces are a scoped class, not a theme.

### 3.2 Color — the cover palette, scoped to `.cover`

Declared on `.cover` (`styles.css:941-949`), not on `:root`, so it exists only
inside the four cover views.

| Token | Value | Line |
|---|---|---|
| `--cover-ground` | `#0a1018` | 942 |
| `--cover-raised` | `rgba(238, 241, 244, 0.035)` | 943 |
| `--cover-ink` | `#eef1f4` | 944 |
| `--cover-ink-2` | `#9dacb7` | 945 |
| `--cover-ink-3` | `#6d7d89` | 946 |
| `--cover-rule` | `rgba(238, 241, 244, 0.22)` | 947 |
| `--cover-rule-soft` | `rgba(238, 241, 244, 0.12)` | 948 |
| `--cover-rule-strong` | `rgba(238, 241, 244, 0.42)` | 949 |

### 3.3 Color — the price palette, scoped to `.cover.prices`

`styles.css:1438-1442`.

| Token | Value | Line | Stated derivation |
|---|---|---|---|
| `--price-1` | `#6fa8d8` | 1439 | `--claimed`, raised for the dark ground |
| `--price-2` | `#d3a34e` | 1440 | `--transfer`, raised the same way |
| `--price-break` | `#e0705a` | 1441 | the audit red, raised |

### 3.4 Color literals used outside any token

These are real colors in the shipped design and are not reachable through a
variable:

| Value | Where | Line |
|---|---|---|
| `#cfe0d8` | `::selection` background | 103 |
| `#f2dcd6` | gap-bar hatch ground (`.gapbar-fill`) | 325 |
| `#f2dcd6` | same hatch on the legend swatch | 365 |
| `rgba(238, 241, 244, 0.02)` | `.sheet` drafting-paper ground | 1170 |
| `rgba(10, 16, 24, 0.72)` | `.stage-node` fill | 1199 |
| `rgba(238, 241, 244, 0.06)` | `.stage-node.is-open` fill | 1209 |
| `rgba(238, 241, 244, 0.08)` | `.gridcard-open:hover` | 1349 |
| `rgba(238, 241, 244, 0.05)` | `.cover .gapbar` track | 1365 |
| `rgba(168, 57, 31, 0.28)` | `.cover .gapbar-fill` hatch ground | 1368 |
| `#1e9a74` | `.cover .gapbar-traced` (green, lifted for dark) | 1369 |
| `#4fc59d` | `.cover .is-traced` text | 1378 |
| `#e0705a` | `.cover .is-gap` text | 1379 |
| `rgba(238, 241, 244, 0.06)` | `.cover .term-body` | 1388 |
| `rgba(238, 241, 244, 0.08)` | `.cover-cta.is-secondary:hover` | 1578 |

Total distinct hues in the system: five semantic accents on paper (`--traced`,
`--claimed`, `--gap`, `--transfer`, `--quality`) plus their dark-ground lifts.
The requirements cap the new product at two accents (§6), so this is the largest
single reduction the repurpose implies.

### 3.5 Font stacks — `:root`, `styles.css:38-40`

```css
--font-display: 'IBM Plex Sans Condensed', 'Helvetica Neue', sans-serif;   /* 38 */
--font-serif:   'IBM Plex Serif', Georgia, serif;                          /* 39 */
--font-mono:    'IBM Plex Mono', 'SF Mono', monospace;                     /* 40 */
```

Role assignment, stated at `styles.css:11-14`: condensed sans for structure,
serif for claims *"so they read as quoted disclosure"*, mono for every number
*"so columns align and magnitudes compare at a glance."*

`body` is `--font-display` at `--t-md` (`styles.css:84-85`).

Fonts are loaded from Google Fonts, not self-hosted — `web/index.html:8-9`:

```
IBM+Plex+Mono:wght@400;500;600
IBM+Plex+Sans+Condensed:wght@400;500;600;700
IBM+Plex+Serif:ital,wght@0,400;0,500;0,600;1,400
&display=swap
```

So the available weights are: Mono 400/500/600, Sans Condensed 400/500/600/700,
Serif 400/500/600 plus italic 400. Any weight outside those lists renders
synthesised.

### 3.6 Type ramp — `:root`, `styles.css:46-54`

| Token | Value | Stated use | Line |
|---|---|---|---|
| `--t-2xs` | `11px` | column heads and eyebrows — tracked, uppercase | 46 |
| `--t-xs` | `13px` | dense metadata | 47 |
| `--t-sm` | `16px` | the floor: table body, chips, captions | 48 |
| `--t-md` | `17px` | reading text | 49 |
| `--t-lg` | `21px` | panel headings | 50 |
| `--t-xl` | `25px` | view headings | 51 |
| `--t-2xl` | `30px` | section statements | 52 |
| `--t-3xl` | `44px` | the one number the page exists to say | 53 |
| `--t-4xl` | `68px` | — | 54 |

The header comment (`styles.css:42-45`) describes this as "one geometric scale
anchored at 16px with a ratio of 1.2". The values are close to that in the middle
(21/17 = 1.24, 25/21 = 1.19, 30/25 = 1.20) and deliberately wider at the display
end (44/30 = 1.47, 68/44 = 1.55) and at the small end (16/13 = 1.23,
13/11 = 1.18). It is a hand-tuned ramp described as geometric, not a computed
one — worth knowing before anyone tries to regenerate it from a formula.

**Responsive overrides of the ramp itself** (the only place sizes change by
viewport):

- `styles.css:1602` — `@media (max-width: 720px) { :root { --t-3xl: 34px;
  --t-4xl: 48px; --t-2xl: 26px; --t-xl: 22px; } }`
- `styles.css:1613` — `@media (max-width: 420px) { :root { --t-4xl: 40px; } }`

The 16px floor is never overridden. Two `em`-relative sizes exist and are the
only font-sizes not on the ramp: `.term-mark { font-size: 0.7em }`
(`styles.css:280`) and `.doc code { font-size: 0.9em }` (`styles.css:851`).

### 3.7 Font weights actually used

Only three values appear across the whole stylesheet: **400**, **500**, **600**,
**700**.

| Weight | Occurrences | Representative lines |
|---|---|---|
| 400 | 4 | `.term-body` 293, `.claim-headline` 652, `.company-verdict` 821 |
| 500 | 1 | `.home-card-claim` 1104 |
| 600 | 20 | `h2,h3,h4` 199, `.finding-figure` 388, `.claimrow-company` 603, `.cover-mark` 1007, `.home-headline` 1064, `.thesis-title` 1143, `.directory-title` 1275, `.gridcard-name` 1304, `.pricepanel-head` 1476 |
| 700 | 1 | `.masthead-title` 161 |

600 is the structural weight; 700 appears exactly once, on the masthead title;
400 is reserved for the serif voice (claim headline, company verdict) and the
definition body.

### 3.8 Letter-spacing

Two families of values: negative tightening on large display type, positive
tracking on small uppercase labels. Nothing in between.

| Value | Use | Lines |
|---|---|---|
| `-0.03em` | `.finding-figure` — the largest number on the site | 390 |
| `-0.02em` | `.home-headline`, `.thesis-title` | 1063, 1143 |
| `-0.015em` | `.directory-title` | 1275 |
| `-0.01em` | `.masthead-title`, `.claim-headline`, `.prices-title` (`-.01em`) | 161, 653, 1451 |
| `-0.005em` | `h2, h3, h4` | 199 |
| `0` | explicit resets so tracking cannot leak into an opened definition | 296, 687, 695, 819, 1227 |
| `.01em` | `.cover-cta` | 1039 |
| `.02em` | `.home-card-open` | 1128 |
| `.04em` | `.pricechart-break text` | 1534 |
| `.06em` | `.gridcard-group` | 1311 |
| `.07em` | uppercase label sets: `.claimrow-kind`, `.kv dt`, `.claim-coding dt`, `.marginwin-step-label`, `.form-field span` | 612, 680, 693, 763, 916 |
| `.08em` | `.filters-group-head`, `.glossary h4`, `.cover-eyebrow-mark`, `.home-card-meta`, `.home-card-fig-label`, `.gridcard-name`, `.gridcard-figure-label`, `.gridcard-dest` | 547, 857, 1031, 1099, 1117, 1305, 1322, 1338 |
| `.1em` | `.sheet-ruler`, `.stage-arrow-label` | 1179, 1241 |
| `.12em` | `.cover-nav button` | 1014 |
| `.14em` | `.cover-eyebrow`, `.stage-mark`, `.sheet-readout-mark` | 1026, 1213, 1253 |
| `.18em` | `.cover-mark` — the widest tracking in the app | 1007 |

Tracking is systematically wider on the covers (.12–.18em) than on the ledger
(.07–.08em).

### 3.9 Line-height

| Value | Where | Lines |
|---|---|---|
| `1` | `.term-mark`, `.finding-figure` | 282, 389 |
| `1.04` | `.home-headline`, `.prices-title` | 1062, 1451 |
| `1.06` | `.thesis-title` | 1142 |
| `1.1` | `.home-card-fig-value`, `.stage-figure`, `.directory-title`, `.gridcard-figure .num` | 1120, 1221, 1274, 1318 |
| `1.2` | `.marginwin-step-value` | 768 |
| `1.25` | `.claim-headline`, `.stage-title` | 652, 1216 |
| `1.32` | `.prices-takeaway` | 1459 |
| `1.35` | `.finding-say`, `.home-card-claim` | 397, 1105 |
| `1.4` | `.claimrow-headline`, `.condition-mark`, `.gridcard-claim` | 621, 706, 1325 |
| `1.45` | `.home-standfirst`, `.stage-caption`, `.sheet-readout-text` | 1072, 1226, 1256 |
| `1.5` | `.term-body`, `.company-verdict` | 294, 818 |
| `1.55` | `body`, `.thesis-lede p` | 86, 1154 |

### 3.10 Spacing scale — `:root`, `styles.css:56-59`

A 4px grid, named by multiple. Note there is no `--s-7`, `--s-9`, `--s-11`,
`--s-13-15`, `--s-17-19`.

```
--s-1:  4px    --s-2:  8px    --s-3: 12px    --s-4: 16px
--s-5: 20px    --s-6: 24px    --s-8: 32px    --s-10: 40px
--s-12: 48px   --s-16: 64px   --s-20: 80px
```

Raw pixel spacing outside the scale, all of it structural rather than rhythmic:
`3px` scrollbar-thumb border (109), `2px` outline-offset (117), `1px` sr-only box
(131), `-60px` skip-link park position (137), `2px`/`3px` text-underline-offset
(239, 251, 604, 623, 799), `1px 5px` on `.filters-count` (523), `0 var(--s-1)` on
`.claimrow-kind` (613), `0 3px` on `.doc code` (852).

### 3.11 Border widths and radius

| Width | Use | Representative lines |
|---|---|---|
| `1px` | the default hairline rule everywhere — panels, rows, chips, inputs, the frame | 172, 189, 275, 577, 1012 |
| `1.5px` | the audit hatch stripe width inside the gap bar gradient | 328-329, 367 |
| `2px` | masthead bottom, section heads, `.claim-head`, `.company-head`, `.doc-head`, `.home-card` left edge, `.prices-takeaway` left edge, focus ring | 152, 643, 805, 845, 1091, 1461, 116 |
| `3px` | `.term-body` left edge, `.finding-clarify`, `.finding-aside`, `.claim-flag`, `.marginwin-step`, `.marginwin-absent` left edges; scrollbar thumb border | 291, 419, 428, 671, 757, 784, 109 |
| `4px` | `.failure` and `.breakdown-item` left accents, `.runlist-item` left accent | 259, 472, 875 |

**Border radius: `0`, once, and only as a reset.** `styles.css:118` sets
`border-radius: 0` on `:focus-visible`. There is no other `border-radius`
declaration in the file. The requirement's 2px ceiling (§6) is already met by a
system that never rounds anything.

SVG stroke widths: `1` (`.stage-arrow` lines, 1237; `.pricechart-grid` 1503;
`.pricechart-axis` 1504), `1.5` (`.pricechart-break line`, 1530), `2`
(`.pricechart-line` 1511, `.pricechart-dot` stroke 1516).

Opacity literals: `.5` on `.btn:disabled` (234), `.7` on `.filters-chip-count`
(564), `1` in the settle keyframe (100).

### 3.12 Layout constants

| Token / value | Meaning | Line |
|---|---|---|
| `--measure: 68ch` | the reading measure, applied to nearly every prose block | 66 |
| `--page: 1080px` | max width of `.main` and `.cover-inner` | 67 |
| `820px` | `.claim`, `.company`, `.doc` max-width | 641 |
| `520px` | `.submit` form max-width | 912 |
| `26ch` / `62ch` | `.home-headline` / `.home-standfirst` | 1067, 1074 |
| `34ch` | `.finding-say` | 399 |
| `46ch` | `.home-card-claim`, `.prices-takeaway` | 1107, 1459 |
| `76ch` | `.home-card` | 1092 |
| `22ch` / `20ch` | `.thesis-title` / `.prices-title` | 1144, 1452 |
| `108ch` | `.thesis-lede` | 1150 |
| `28px` | the ruled-paper background repeat on `body` | 90 |
| `56px` | the drafting-grid repeat on `.sheet` | 1172-1173 |
| `33.333%` | the cover frame's interior verticals, at the thirds | 982 |
| `680px` | `.pricechart` min-width — the one sideways-scrolling container | 1501 |
| Breakpoints | `900px` (1395), `720px` (1405, 1582, 1601), `420px` (1612) | — |

Global anti-sideways-scroll rule: `html, body { overflow-x: hidden; max-width:
100% }` — `styles.css:1621`.

### 3.13 Motion tokens

`:root`, `styles.css:62-64`:

```css
--motion-fast: 120ms;
--motion-base: 200ms;
--motion-ease: cubic-bezier(.2, .6, .35, 1);
```

`--motion-fast` is used for every hover/color transition; `--motion-base` for the
one shell `settle` fade (`styles.css:98-101`), which is itself wrapped in
`@media (prefers-reduced-motion: no-preference)`.

The global reduced-motion block at `styles.css:121-128` collapses every
animation, transition and `scroll-behavior` to `0.001ms !important`.

JS-driven motion is **not** on these tokens. It lives in the vendored React Bits
components and their call sites:

| Value | Where |
|---|---|
| stagger `delay={45}` ms per word | `views/HomeView.tsx:84`, `views/PricesView.tsx:62` |
| stagger `delay={55}` ms per word | `views/ThesisView.tsx:107` |
| CountUp `duration` 1.4 / 1.2 / 1.6 s | `views/ThesisView.tsx:53`, `:64`, `:75` |
| card entrance `duration: 0.32` s, `delay: min(i * STEP, LAST_ENTRANCE)` | `views/DirectoryView.tsx:82-84` |
| spring `damping = 20 + 40 * (1/duration)`, `stiffness = 100 * (1/duration)` | `vendor/reactbits/CountUp.tsx:77-78` |
| blur reveal keyframes `blur(10px)→blur(5px)→blur(0px)`, `opacity 0→0.5→1`, `y ±50→0` | `vendor/reactbits/BlurText.tsx:100-111` |
| price chart draw-in `DRAW = 1.1` s, `STEP = 0.08` s | `components/PriceChart.tsx:45-46` |

So the codebase already uses springs (CountUp) and index-based stagger, which is
what the requirements' motion section asks for — but the numbers are per-call-site
constants, not tokens.

### 3.14 Typographic mechanics that are load-bearing

- `font-variant-numeric: tabular-nums` is set on `.mono` and `.num`
  (`styles.css:211-212`) and repeated on eight specific number elements (344,
  391, 411, 457, 631, 767, 1222). Every number in the app is already tabular.
- `.term-body` expands **in flow** (`display: block`, `styles.css:286-287`);
  nothing in the app is positioned over the content it explains
  (`styles.css:264-267`, restated at `1538-1539`).
- The one focus ring is `2px solid var(--claimed)` with `2px` offset
  (`styles.css:115-119`), recoloured to `--cover-ink` on dark grounds
  (`styles.css:1051`) and never removed.
- `scrollbar-color`, `scrollbar-width` and the `::-webkit-scrollbar` rules are
  set once globally (`styles.css:72-73`, `105-111`).

---

## 4. The Cloudflare Worker

Source: `worker/src/`. Config: `worker/wrangler.jsonc`.

### 4.1 Schedule

`worker/wrangler.jsonc:13` — `"triggers": { "crons": ["15 6 * * *", "45 6 * * *"] }`

`worker/src/index.ts:424-427`:

```ts
export const CRON_JOBS: Record<string, 'fundamentals' | 'prices' | 'outcomes'> = {
  '15 6 * * *': 'fundamentals',
  '45 6 * * *': 'outcomes',
};
```

Two triggers, two jobs, thirty minutes apart — one job per invocation, because
the subrequest budget is per invocation (`index.ts:413-423`, and the same reason
in the wrangler comment at `wrangler.jsonc:6-12`). The `scheduled` handler looks
the job up by cron string and returns if there is no match (`index.ts:459-460`).

**Prices are off the schedule but not deleted**: `PRICES_ON_SCHEDULE = false`
(`index.ts:411`), guarded again in `scheduled` (`index.ts:461`) and in `runAll`
(`index.ts:437`). The job is still reachable manually.

### 4.2 What each job fetches, and where it writes

**Job 1 — `runFundamentals`** (`index.ts:59-153`)

- Reads `companies` where `is_public = true`, selecting
  `id,slug,name,ticker,cik,stooq_symbol,is_public` (`index.ts:67-70`).
- For companies with a ticker but no CIK, fetches the SEC ticker map at
  `https://www.sec.gov/files/company_tickers.json` (`worker/src/sec.ts:9`) and
  **patches `companies.cik`** (`index.ts:79`).
- For each company with a CIK, fetches SEC company facts and extracts series
  (`index.ts:106-107`). Concepts, with fallback chains, at `sec.ts:38-54`:
  - `revenue_q` ← `RevenueFromContractWithCustomerExcludingAssessedTax`,
    `Revenues`, `RevenueFromContractWithCustomerIncludingAssessedTax`,
    `SalesRevenueNet`, `SalesRevenueServicesNet`
  - `operating_income_q` ← `OperatingIncomeLoss`,
    `IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest`
  - `cost_of_revenue_q` ← `CostOfRevenue`, `CostOfGoodsAndServicesSold`,
    `CostOfServices`
  - `opex_q` ← `OperatingExpenses`, `CostsAndExpenses`
  - `rnd_q` ← `ResearchAndDevelopmentExpense`
  - `net_income_q` ← `NetIncomeLoss`
  - plus two derived: `operating_margin_q` (`sec.ts:107-110`) and
    `gross_margin_q` (`sec.ts:118-129`)
- Lookback: `extractSeries(facts, sinceIso = '2019-01-01')` — `sec.ts:83`, filter
  at `sec.ts:90`.
- Rate limit: `await sleep(150)` per company, "comfortably inside the SEC's 10
  requests per second" (`index.ts:133`).
- **Writes**: one batched upsert into `observations` on conflict
  `company_id,series_key,observed_at,source`, with `source: 'sec_xbrl'`
  (`index.ts:117`, `136`, `10`). Batched deliberately — it was one upsert per
  company (`index.ts:96-101`).
- A company that files with the SEC but reports no us-gaap concepts is recorded
  as `expected: true` and does not make the run fail (`index.ts:122-128`,
  `146`).

**Job 2 — `runPrices`** (`index.ts:158-222`) — *not on the schedule*

- Reads `companies` where `stooq_symbol is not null`, selecting
  `id,slug,stooq_symbol` (`index.ts:167-170`).
- Fetches `https://stooq.com/q/d/l/?s=<symbol>&i=d` (`worker/src/stooq.ts:28-30`).
- Lookback: `parseStooqCsv(text, sinceIso = '2021-01-01')` — `stooq.ts:89`.
- Rate limit: `await sleep(400)` per symbol (`index.ts:199`).
- **Writes**: upserts into `observations` with `series_key: 'price_close'`,
  `unit: 'usd'`, `source: 'stooq'` (`index.ts:182-191`).
- A source-level failure (`challenge`, `hit_limit`, `http` — `stooq.ts:52`)
  breaks the loop and is reported once rather than per symbol
  (`index.ts:176`, `193-196`, `202-209`).

**Job 3 — `runOutcomes`** (`index.ts:232-364`)

- Reads `claims` where `status = 'published'`, selecting
  `id,company_id,claim_date` (`index.ts:241-244`).
- Reads `observations` **once per series for the whole table**, four queries
  total, grouped by company in memory (`index.ts:271-299`). Series:
  `OUTCOME_SERIES = ['operating_margin_q','price_close','opex_q','revenue_q']`
  (`index.ts:11`). Ordered `company_id.asc,observed_at.asc` so pagination is
  stable and points arrive date-ascending (`index.ts:278-280`).
- **Writes**: upserts into `claim_outcomes` on conflict `claim_id,series_key`
  (`index.ts:332`).
- Emits a branch tally in `notes` so a run that writes nothing explains itself
  (`index.ts:337-354`).

**Every run** writes a row to `fetch_runs` — an insert on start and a patch on
finish or throw — through `recordRun` (`index.ts:24-54`). Both writes go through
`db.reserved()`, which may spend the held-back subrequests, so a job that runs
out of budget can still file the fact (`index.ts:17-23`).

### 4.3 Subrequest budget

`worker/src/db.ts`: `DEFAULT_SUBREQUEST_LIMIT = 50` (line 42),
`DEFAULT_RESERVE = 4` (line 45), pagination `PAGE = 1000` (line 32) with explicit
`from`/`to` Range headers (lines 147-148) and a short-page stop (line 161).

### 4.4 Outcome window constants

`worker/src/outcomes.ts:103-108` — the defaults the Worker computes with:

```ts
baselineLookbackDays = 400,
q1ToleranceDays      = 50,
q4ToleranceDays      = 70,
asBps                = false,
```

Targets: `t1` at claim date + **91 days**, `t4` at claim date + **365 days**
(`outcomes.ts:121-122`). `OutcomeReason` is a closed union of five —
`'ok' | 'no_series' | 'no_baseline_before_claim' | 'baseline_too_old' |
'no_forward_reading'` (`outcomes.ts:33-38`) — and is **never written to the
database**: `toRow` strips it (`outcomes.ts:178`). `web/src/lib/outcome.ts`
recomputes the equivalent explanation in the browser, and `test/outcome.test.ts`
reads the Worker source to assert the constants have not drifted.

### 4.5 HTTP surface

`index.ts:469-516`. Four paths:

| Path | Auth | Behaviour | Line |
|---|---|---|---|
| `/health` | none | config check, lists missing secrets | 477-479 |
| `/smoke?symbol=` | none | live Stooq probe; 503 when it fails | 484-487 |
| `/run?job=all\|fundamentals\|prices\|outcomes&token=` | `RUN_TOKEN` | trigger a job now | 489-506 |
| *(anything else)* | none | service description | 508-515 |

Required secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SEC_USER_AGENT`,
`RUN_TOKEN` (`index.ts:447-449`).

---

## 5. What could not be determined from the code

1. **Live database state.** Every count in this document comes from the seed
   files (45 company rows, 84 claim rows). The actual contents of the Supabase
   project — including whether `01_schema.sql` has been re-run since it was last
   edited, and whether anything was altered directly in the SQL editor — is not
   in the repository and was not queried.
2. **Whether the schema has drifted from `01_schema.sql`.** There is no
   migrations directory and no schema dump, so a column added by hand in the
   Supabase editor would be invisible here.
3. **The Supabase project ref and the anon key.** `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` are build-time variables; no `.env` is committed
   (`.gitignore`). Which project the deployed bundle points at was not verified.
4. **Which Cloudflare Worker currently answers, and with what.**
   `web/wrangler.jsonc:20` targets `ai-outcome-ledge1`. No live request was made,
   so the deployed state of either frontend Worker is unconfirmed here.
5. **Whether the crons are actually firing.** `wrangler.jsonc` declares them;
   whether the deployed Worker carries the same triggers, and what the most
   recent `fetch_runs` rows say, requires a deploy query and a database read.
   Neither was done.
6. **`source_url` coverage.** The column exists (`01_schema.sql:104`) and
   `v_ledger` exposes it (line 244). Whether it is populated for any row is a
   database question, not a code question.
7. **Three claims in `planning/requirements.md` §1 contradict the code and
   should be corrected before planning proceeds:**
   - It says **React 18**; `web/package.json:20-21` pins `react` and `react-dom`
     at `^19.2.8`.
   - It says **Recharts**; there is no chart library in `web/package.json` at
     all. The only chart is hand-rolled SVG (`components/PriceChart.tsx`), and
     the only animation dependency is `motion@^12.43.0`
     (`web/package.json:19`).
   - It says **Cloudflare Pages**; `web/wrangler.jsonc:1-3` states explicitly
     that the frontend is a Worker serving static assets and that no Pages
     project exists on the account. It also says Vite 5; `web/package.json:31`
     pins `vite@^6.4.3`.
8. **Table-name mismatch.** Requirements §1 lists a table called `claims`,
   which exists, but describes `observations` as feeding "derived outcomes" —
   the actual derived table is `claim_outcomes`, and the public-submission table
   is `claim_submissions`. Worth fixing in the requirements so the migration
   plan names real objects.
9. **`RUN_TOKEN`'s current value** is not in the repository (by design).
10. **Whether any historical `price_close` observations exist.** The Stooq job is
    off the schedule and the source is refusing automated clients, but rows
    collected before that may still be in `observations` and would still produce
    `claim_outcomes` rows (`index.ts:405-409`). Only a database read settles it.

---

## 6. One thing the extraction makes obvious

The existing system is already most of the way to the requirements' design
mandate: zero border radius, no gradients used as decoration, tabular figures
everywhere, a 16px floor, hairline rules instead of shadows, and a single
`cubic-bezier` motion token with a working reduced-motion path. The two real
gaps against §6 are the **accent count** — five semantic hues on paper plus their
dark-ground lifts, against a cap of two — and the fact that the **workpaper
vernacular the mandate asks for (cross-reference indices, tickmarks with defined
meanings, preparer/reviewer blocks, lead schedules) does not exist in the
codebase**. The closest existing analogues are `.cover-eyebrow-mark`
(`styles.css:1029`), `.stage-mark` (`:1211`), `.sheet-ruler` (`:1176`) and
`.condition-mark` (`:704`) — four one-off marks, not a system with a legend.
