# AI Outcome Ledger

A maintained record of every public claim of an AI gain, coded against what was
actually measured.

**The headline result: of $8.393B in AI gains claimed in dollars, $428.0M —
5.1% — can be matched to a named line item in a financial statement.**

That is not an accusation. Several of these claims are audited and true. The
ledger measures the distance between a number being *real* and a number being
*locatable*, and codes where each gain went instead: absorbed as slack, kept as
quality, taken from a supplier, passed to customers, or kept as margin.

84 rows across 45 companies and research populations. Half hand-coded, half
collected from SEC filings by a scheduled worker.

---

## What is in the repository

```
web/            Vite + React 19 + TypeScript frontend
  src/lib/      pure logic — every aggregate, filter, route and generated sentence
  src/views/    the five surfaces
  test/         321 tests, no browser required
  shots/        screenshot capture and the scripted click-through
worker/         Cloudflare Worker: SEC XBRL, Stooq, and derived claim outcomes
  test/         128 tests, never touches the network
  smoke/        the one live check, run on demand
supabase/       schema, row-level security, and seed data — run in the SQL editor
docs/           data dictionary, methodology, and before/after screenshots
REBUILD.md      the 2026-08-15 architecture decision record
CLAUDE.md       the invariants. Read this before changing anything
```

The five surfaces:

| Route | What it is for |
|---|---|
| `#/` | The finding, where the claimed dollars went instead, what the rows say, and every row |
| `#/claim/<ref>` | One claim, fully unpacked: coding, conditions, what the filings show, the source |
| `#/company/<slug>` | One company's whole record, with a generated verdict |
| `#/method` | How a row is coded and how every figure is computed |
| `#/maintenance` | Collector health, the checking queue, the submission inbox |

---

## Local setup

Node 20 or newer.

```bash
git clone <this repo>
cd ai-outcome-ledger
```

### The database

Run the four files in `supabase/` **in order**, in the Supabase SQL editor:

```
01_schema.sql        tables, views, controlled vocabularies
02_policies.sql      row-level security
03_seed_companies.sql
04_seed_claims.sql
```

`01` and `02` are safe to re-run.

### The frontend

```bash
cd web
cp .env.example .env.local     # then paste the project URL and the anon key
npm install
npm run dev                    # http://localhost:5173
```

Both variables are **build-time**. Vite bakes them into the bundle, so changing
one needs a rebuild, not a restart — and a build made without them *succeeds*,
producing a site that renders its own chrome and asks a hostname that does not
exist for its data. Before deploying, check:

```bash
grep -o 'https://[a-z0-9-]*\.supabase\.co' dist/assets/*.js | sort -u
```

The anon key is safe in the browser: RLS limits it to reading published rows and
inserting a submission. **Never put the service-role key in `web/`.**

### Without a database

```bash
cd web
VITE_FIXTURES=1 npm run dev
```

45 invented companies with clearly synthetic names and figures. The fixtures are
behind `import.meta.env.DEV` *and* an explicit flag, so production builds drop
the module entirely. They deliberately include the awkward shapes the real corpus
has: gain claims with no dollar figure, a traced figure on a claim that named no
dollars, filers with no readable series, and claims too recent to have a reading
a year later.

### The collector

```bash
cd worker
cp .dev.vars.example .dev.vars   # service-role key, SEC user agent, run token
npm install
npm run dev                      # wrangler dev, with --test-scheduled
```

`SEC_USER_AGENT` must be a descriptive string with a contact email or the SEC
returns 403.

---

## Running the collectors

Three jobs, each reachable on demand and each with its own cron trigger:

```bash
curl "$WORKER_URL/run?job=fundamentals&token=$RUN_TOKEN"   # SEC XBRL quarterly series
curl "$WORKER_URL/run?job=outcomes&token=$RUN_TOKEN"       # derived claim outcomes
curl "$WORKER_URL/run?job=prices&token=$RUN_TOKEN"         # off the schedule; see below
curl "$WORKER_URL/health"                                  # config check, no token
curl "$WORKER_URL/smoke"                                   # live check of the price source
```

**One job per cron trigger, deliberately.** A Worker invocation has a subrequest
ceiling, and two jobs sharing one invocation share one budget. `fundamentals`
runs at 06:15 UTC and `outcomes` at 06:45 UTC so neither can starve the other.
`CRON_JOBS` in `worker/src/index.ts` and `triggers.crons` in
`worker/wrangler.jsonc` must agree; a test fails if they do not.

**Check a run with `finished_at`, not with `rows_written`:**

```
fetch_runs?select=job,started_at,finished_at,ok,rows_written,notes
  &job=eq.outcomes&order=started_at.desc&limit=3
```

A null `finished_at` means the invocation was killed part-way through. A row with
notes means it ran.

Prices are off the schedule: the free source began serving a proof-of-work
interstitial to automated clients in August 2026. The job is kept and tested;
wiring a new source is one `fetchPrices` implementation and flipping
`PRICES_ON_SCHEDULE`.

---

## Running the tests

```bash
cd web    && npx tsc --noEmit && npm test && npx vite build
cd worker && npx tsc --noEmit && npm test
```

Expected: **321** web tests, **128** worker tests, silent typechecks, clean build.

Screenshots of every surface at 1440px and 390px:

```bash
cd web && npx vite build && npx vite preview --port 5200
cd web && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' SHOT_BASE=http://localhost:5200 \
  SHOT_DIR=../docs/rebuild/after npm run shots -- "ledger=#/" "method=#/method"
```

The `MSYS_NO_PATHCONV` prefix is only needed on Git Bash for Windows, where MSYS
otherwise rewrites `#/method` into a Windows path and every shot silently
captures the home page.

The scripted click-through — cold load, drill to a company, drill to a claim,
reach the source, back out, filter, cross-check a total, hard-reload a deep link,
browser back — with zero console errors as a pass condition:

```bash
cd web && npm run walk
```

The live check of the price source, which is not in the gate because a gate that
goes red when a third party has a bad afternoon stops being read:

```bash
cd worker && npm run smoke
```

---

## Deploying

Nothing deploys on push. Pushing to `main` publishes code to GitHub and changes
nothing that is serving.

```bash
cd web    && npm run deploy        # builds, then wrangler deploy
cd worker && npx wrangler deploy   # only needed when worker/ changed
```

`/ship` runs the gate, commits, pushes, and reports the deploy status.
`/rollback` restores the last known-good deployment before diagnosing.

---

## The coding vocabulary

Every claim is coded against what the source actually measured and where the
gain landed. The `#/method` page renders the full definitions, generated from the
same file the interface uses.

**Where the gain landed**, ordered by distance from profit:

| | |
|---|---|
| Absorbed as slack | Hours freed and kept inside the business. Nothing left the cost base |
| Kept as quality | A real gain that landed in wellbeing, service or cycle time. No P&L line |
| Taken from a supplier | The buyer's saving is a supplier's revenue decline |
| Passed to customers | The surplus reached the buyer through a lower price |
| Kept as margin | Retained as profit |

**What was measured** distinguishes an audited cost line from an hourly rate
multiplied by a headcount: `A line item moved`, `Price per unit`, `Hours freed`,
`People`, `Time`, `Quality`, `Usage volume`, `Source doesn't say`.

**The three conditions** for a gain to reach profit: the billing unit survives,
there is somewhere for the freed capacity to go, and the firm has permission to
act. An uncoded condition is not a failed one.

Only rows coded `gain_claim` enter a money total, and only those that named a
figure in dollars enter the traceable percentage. See `docs/DATA_DICTIONARY.md`
for every column and `docs/METHODOLOGY.md` for how rows are selected.

---

## Contributing a claim

Use the form on `#/maintenance`. Submissions land in an inbox, not in the ledger:
nothing appears in the record until it has been read, coded by hand against a
source, and given a destination.

---

## What this cannot tell you

- **Whether a claim is true.** "Not traceable to a filing line" measures
  locatability, not honesty.
- **Whether AI caused anything.** Every figure is an association in time between
  a stated claim and a disclosed number. No part of any margin movement shown has
  been attributed to AI.
- **What is not in the ledger.** This is a hand-built record of public claims,
  not a survey. Absence from it is not evidence of anything.
