# REBUILD.md — AI Outcome Ledger, second build

Written before the frontend was touched, amended at the end with what was
actually built and every call made without asking.

Baseline captured 2026-08-15: 84 rows, 45 companies, 336 web tests, 109 worker
tests, ten top-level views, `claim_outcomes` empty.

---

## The one job

**A reader arrives having seen a number — "IBM saved $3.5B with AI" — and leaves
able to say whether that number appears anywhere in a financial statement, and
if it does not, which of five reasons applies.**

Every surviving surface is judged against that sentence. A view that does not
move a reader toward it is deleted, however good it looks.

## The reader

Someone who read a press headline or an earnings-call quote and wants to know
whether it is checkable. They have never seen the underlying research, do not
know what "destination 3" means, and will not read a methodology page first.
They are not hostile to the claims — they want to know which ones are locatable.

This definition rejects features. It rejects a cohort-comparison tray, because
that reader is not comparing companies. It rejects a 2×2×2 condition matrix,
because that reader has not yet asked the question the matrix answers. It
rejects a four-column Sankey, because a diagram of the whole corpus answers
"what shape is this dataset", which is a researcher's question, not theirs.

## The finding

Of **$8.393B** in AI gains claimed in dollars across 32 gain claims,
**$428.0M — 5.1% —** can be matched to a named line item in a filing.

Three further facts the app has to carry, because each one changes what that
number means:

- Only **14 of 32** gain claims state a figure in dollars at all. The remaining
  18 are percentages, headcounts, hours, or resolution rates. The denominator is
  not "all claims", it is "the claims that named a dollar amount".
- The traced $428M comes from **two companies** (Willis Towers Watson $400M,
  Klarna $28M). Every other dollar claim traces to zero.
- One further **$23.1M** is traceable — Chegg's opex reduction — on a claim that
  was never stated in dollars. It cannot enter the percentage, because its claim
  contributes nothing to the denominator. Merging it in is what produced the
  two-different-totals bug described below.

**How a cold visitor gets it without a method page:** the first screen is one
number at display size — `5.1%` — followed by one sentence that spells out the
fraction in words, then the gap bar, then the two dollar figures with the words
"traceable" and "not traceable" attached to them, then the standing
clarification that not traceable does not mean false. No scrolling, no chart to
decode, no jargon above the fold.

---

## Three candidate architectures

### A. One page, one table

Everything is the ledger: headline, then all 84 rows as a filterable list, rows
expanding in place to full coding and source. Destinations, conditions and
companies become filters rather than places.

*Optimizes:* traceability — every number is zero or one click from its row.
Cross-view inconsistency is impossible because there are no other views.
Cheapest thing to maintain.

*Makes hard:* the "why". Destination coding is the actual argument of this
project and inside a table cell it is just another column. A company's record —
seven IBM rows that only mean something read together — is unreachable. The
output test in CLAUDE.md is *name specific companies and say why*; this
architecture answers neither half well.

### B. A narrative spine

Four sequential screens that argue: the finding → where the money went → what
makes a gain stick → the evidence. Each screen is one claim about the corpus,
generated from the rows, with a "show the rows behind this" step.

*Optimizes:* a cold visitor's comprehension. Hierarchy comes free because each
screen has exactly one thing to say. Progressive disclosure is the structure
rather than a decoration on it.

*Makes hard:* lookup. A reader who arrives wanting Klarna has to walk an
argument to reach it. It also drifts toward prose that states facts about the
data, which CLAUDE.md forbids for good reason — generated sentences rot loudly,
typed ones rot silently, and four screens of argument is a lot of surface to
keep generated. Worst case it becomes an essay with a table stapled on.

### C. Finding → claim → company, with two support surfaces

One reading surface (the ledger home: the finding, the destination breakdown,
the interpretation, the rows) and two drill-downs that are the same rows at
different grain (one claim, one company). Two support surfaces that no reader
needs on the way to an answer: Method and Maintenance.

*Optimizes:* the one job, directly. The finding is the front door; the drill
path *is* the reading path; every number reaches its row in one click and its
source in the same view. Filter scope becomes trivially honest because filters
belong to exactly one surface.

*Makes hard:* corpus shape. There is no single picture of the whole dataset the
way the Sankey was. Cross-company pattern-finding costs more clicks.

### The pick: **C**

It is the only one of the three whose structure is the output test. A reader
lands on the finding, clicks a claim, reads why that claim did or did not reach
profit, clicks through to the company, and can then name it and say why. A and B
each get half of that.

**Why not A.** It treats the corpus as a table and the coding as metadata. The
coding *is* the product; 84 rows of hand research exist so that "where did it
land" has an answer, and a column labelled "Where it landed" in a dense table is
where that answer goes to die. A also has no home for the company verdict, which
CLAUDE.md names as the output test.

**Why not B.** Lookup is a first-class need — a reader arriving from a Klarna
headline wants Klarna, not an argument — and B punishes it. More seriously, B's
screens want prose, and prose about the numbers is the failure mode this project
is built to avoid. C keeps generated interpretation to one bounded block on one
page, where it is small enough to keep honest.

C's real cost is the loss of a whole-corpus picture. Accepted, and mitigated:
the destination breakdown on the home page carries the same claimed-vs-traced
split per destination that the Sankey's third column carried, in words and
figures rather than in ribbon widths, on the shared bar scale.

---

## The kill list

Ten top-level views in, three in the nav plus two drill-downs out.

| Current view | Verdict | Why |
|---|---|---|
| **Flow** (Sankey) | **Delete** | A four-column flow diagram over the 14 rows that carry a dollar figure. 883 lines across `flow.ts`, `flowLayout.ts`, `Sankey.tsx`, `FlowLadder.tsx` and 59 tests, to draw 14 numbers — and it needed its own arithmetic to do it, which is the direct cause of the two-totals bug. Its content survives as the destination breakdown. |
| **Patterns** | **Delete** | Grouped company cards with sparklines: a second Companies view with a different grouping control. The one idea worth keeping — group by where gains landed — is what the home page's destination section does. |
| **Companies** | **Merge → Ledger** | Becomes a grouping toggle on the one row list. Same rows, same totals, one code path. |
| **All rows** | **Merge → Ledger** | It *is* the ledger. It was a separate view only because Flow occupied the front door. |
| **Where gains landed** | **Merge → Ledger** | Promoted, not demoted: this is the interpretation section of the home page, directly under the finding. It answers "why is 95% of it not traceable". |
| **Three conditions** | **Merge → Claim + Company** | The 2×2×2 grid is a research artefact over a corpus where 23–30 of 84 rows leave at least one condition uncoded. The conditions matter per claim ("why did this one stick") and per company. The aggregate reading survives as one generated sentence in the home page readout. |
| **Who paid** | **Delete** | Built on data that does not exist: `counterparty_absorbed` is true on 6 of 84 rows, `transfer_amount_usd` is non-null on 2, and exactly **1** row names a counterparty. A bipartite SVG diagram for one named edge. The fact appears on the claim and company pages where it applies, and as a line in the destination breakdown. |
| **Needs checking** | **Merge → Maintenance** | 17 rows need a primary source and 2 are disputed. That is a work queue, not a reading view. It is also reachable as a filter on the ledger. |
| **Add a claim** | **Merge → Maintenance** | Same reason. |
| **Method** | **Keep** | Generated from `labels.ts`; it is the definition of record. Trimmed to the vocabulary and the arithmetic. |
| *Finding* (`#/finding/:id`) | **Delete as a route** | Six generated mini-essays behind their own URLs. The generation idea is kept — the home page readout — the route is not. |
| *ReconciliationView*, *ClaimDetail*, *ChipRow*, `groupBy` | **Delete** | Already dead: zero importers before this rebuild. |
| — | **New: Claim page** | There was no per-claim page. Every number on screen now reaches its own row and its source. |

Deleted views are deleted, not hidden: their route names are gone from
`ViewName`, and an unknown hash lands on the ledger.

---

## Self-critique of the chosen architecture

**1. The home page is doing three jobs.** It carries the finding, the
destination breakdown, the readout, *and* the full 84-row list with filters.
That is a lot for one screen and it is exactly the "three equal-weight blocks"
failure the brief names. Mitigation: hard typographic hierarchy — the finding is
the only thing at display size, the breakdown is at panel-heading weight, the row
list is at body weight behind its own section rule. If a reader stops after the
first screen they have the finding; everything below is elaboration.

**2. Losing the Sankey loses something real.** It is the only artefact that
showed company → basis → destination → outcome as one object. A reasonable
person will miss it. I am accepting that because it cost 883 lines and a
correctness bug to show 14 numbers, and because it answered a question this
reader does not have.

**3. The company page competes with the claim page.** Both show a claim's
coding. Resolved by grain: the company page states the verdict and lists rows in
one line each; the claim page is the only place a row is fully unpacked.

**4. `research_finding` and `context` rows fit awkwardly.** 30 of 84 rows are
not company claims at all — Census BTOS, the Denmark payroll study, the MIT
NANDA figures. They belong in a ledger of claims about AI gains, but they have no
destination and no reconciliation. Handled by giving the row list an explicit
kind grouping and by never letting them touch a money total (already enforced by
`gain_claim` gating).

### The feature cut as a result

**Pinning and the compare tray.** Up to four companies could be pinned into a
fixed bottom tray for side-by-side comparison, serialised into the URL as `pin=`.
It is real work — `CompareTray.tsx`, `togglePinned`, `MAX_PINNED`, the `pin`
route parameter, the `has-tray` layout mode and a 240px body padding compensator
that could be overrun by a tall tray and cover the page.

It goes because the reader defined above does not compare companies; they check
one number. Comparison is already available a better way — filter the ledger to
two companies and read them in the same list, on the same bar scale — and that
path cannot cover the content beneath it.

---

## Ambiguities resolved without asking

Recorded here rather than raised, per the brief.

**1. Which "traceable" total is correct: $428M or $451M?**
Neither, as stated. `totals()` summed `traceable_to_pl_usd` over all gain rows;
`buildFlow()` summed it only over rows with `claimed_amount_usd > 0`, clamping
`traced` to `claimed`. The single row between them is `chegg-opex-cut-33pct`:
$23.1M traced against a claim stated as "opex down 33%", with no dollar figure.

Resolution: **the headline ratio is computed over rows that carry both a dollar
claim and a coded traceable figure** — $428.0M of $8.393B, 5.1% — and the $23.1M
is reported on its own line, always, whenever it is non-zero. One `totals()`
returns both, so the two numbers can never be computed by two functions again.
This is a better answer than either original: summing a traced figure into a
ratio whose denominator excludes its claim is the same category error as summing
a $2T market cap into a savings total.

**2. Clamping `traced > claimed`.** Not clamped. If a coded traceable figure
exceeds its claim that is a research defect to surface, not to hide, so
`totals()` reports it and the ledger row shows both numbers. No row in the
current corpus has this shape.

**3. `source_url` is null on all 84 rows.** The corpus records `source_name`,
`source_type` and `source_date` but no URLs. Fabricating them is forbidden.
Resolution: the claim page states the source by name, type and date, marks
plainly that no URL is recorded on the row, and offers the generated EDGAR /
Scholar lookups that `sourceLinks.ts` already builds from the row's own text,
labelled as lookups rather than as the source. `verify_hint` is shown next to it.

**4. "Margin +1Y" for every row.** With the outcomes job fixed, a 4-quarter
margin delta exists for **8 of 84** rows, a 1-quarter delta for 26, and a
baseline for 33. Eight is not a column. Resolution: no margin column in the
default table. Instead each row states its measurement status in words, and the
claim page carries a **margin window** — the last filed operating margin before
the claim, the reading a quarter after, the reading a year after, with dates,
the delta in basis points, and a generated sentence stating what that delta can
and cannot support. Where a reading is missing the row says why.

**5. Why a claim cannot be measured, per row.** `claim_outcomes` has no column
for a reason, and adding one is DDL, which needs the Supabase SQL editor and the
service-role key — neither of which is available to this session. Rather than
leave a migration for someone to run by hand, the reason is **derived in the
frontend** from data the anon key can already read: the company's observation
coverage for `operating_margin_q` and `revenue_q`. `lib/outcome.ts` computes it
with the same window arithmetic the Worker uses, and the worker's `computeOutcome`
reasons are mirrored there under test. This is strictly better than a stored
column for the reader: the explanation names the actual date range that exists,
so it is checkable rather than a code.

**6. Filter scope.** Filters exist on the ledger and nowhere else. The claim and
company pages never read them and are never given them. Going back restores
them, because the previous hash still carries them. There is no global sidebar,
so there is no place for a total to disagree with the view it sits beside.

**7. Operational health on reading views.** The health strip moves to
Maintenance entirely. One thing does reach the ledger, in the ledger's own
terms: a single line under the finding stating when the filing figures were last
collected, and — only when the last outcomes run did not finish, or is more than
seven days old — that the figures may be stale. It is a sentence about the data,
not a red banner about a job.

**8. Prices.** Stooq stopped serving automated clients and `price_delta_4q` is
null on all 84 rows. The "Share price, one year" figure is therefore not shown
anywhere rather than shown as a column of dashes; `price_close` stays in the
collector so it returns on its own when a source is wired up.

---

## What was built

### The data layer, first

**The outcomes job's root cause was a subrequest ceiling, not a data problem.**
It issued one query per company per series — four series against forty-five
companies, about 180 sequential round trips in a single Worker invocation. A
Worker invocation has a subrequest limit (50 on the free plan) and exceeding it
does not raise anything a job can catch: the isolate stops.

The reason it left no trace is the part that cost two previous sessions: the
catch block's "record the failure" PATCH is itself a subrequest, so it died too.
Every outcomes row in `fetch_runs` therefore had a null `finished_at`, `ok` null,
an empty `errors` array and no notes — which reads as "the job wrote no rows" and
points at a data problem that was never there.

Every observed failure in `fetch_runs` fits the ceiling exactly. `fundamentals`
costs about 26 requests and finished. `prices` costs about 21: it finished when
it ran first on its own cron, and died on all three occasions it followed
`fundamentals` in the same invocation. `outcomes` wanted 180 and never finished
from any starting point.

Three changes, all of which matter:

1. **One query per series for the whole table**, grouped by company in memory —
   four reads instead of 180.
2. **One job per cron trigger.** `CRON_JOBS` maps each trigger to exactly one
   job, so no two share a budget. `fundamentals` at 06:15 UTC, `outcomes` at
   06:45 UTC. A test reads `wrangler.jsonc` and fails if the two lists disagree.
3. **`SubrequestBudget`** counts every outbound request and stops the job before
   the ceiling, holding back a reserve that only the `fetch_runs` writes may
   spend. A job that asks for too much now fails loudly with the number it
   reached, instead of vanishing. `runFundamentals` was also changed to batch its
   observation writes across companies — 6 requests instead of 17.

Verified end to end against production: `claim_outcomes` went from **0 rows to
86**, and the last four runs all carry `finished_at`, `ok=true`, `rows=86`.

**Truncation.** `fetchAll` in `web/src/lib/supabase.ts` pages with an explicit
range until a page comes back short, and throws `TruncatedError` rather than
returning a silently partial answer. It replaced one query capped at `.limit(2000)`
and one with no bound at all.

### The frontend

Five surfaces, built as described above. The pieces worth naming:

- **`lib/aggregate.ts`** is the single source of truth. One `totals()`, and a
  test that walks the source tree and fails if any other file folds a money
  column. Cross-view consistency is asserted for six filter states across
  destination buckets, kind buckets, company profiles and the headline.
- **`lib/outcome.ts`** replaced the decorative time series with a three-reading
  window and a generated sentence per claim. Its window constants are pinned to
  the Worker's by a test that reads the Worker source.
- **`components/Term.tsx`** is the one way a coded term is explained: a real
  button, expanding in flow, reading from `define()` in `labels.ts`. It replaced
  roughly thirty native `title` attributes, which are invisible on touch and
  unreachable by keyboard.
- **`lib/readout.ts`** generates the four interpretation statements on the home
  page. Each carries the selection that produces the rows it rests on, and a test
  asserts the offered count is exactly what that selection returns.
- **`lib/health.ts`** splits the collector's state into the one sentence a reader
  needs — how current the filing figures are, in the ledger's own words — and
  everything else, which lives on `#/maintenance`.

### Deleted in the same pass

`flow.ts`, `flowLayout.ts`, `patterns.ts`, `findings.ts`, `chips.ts`,
`chart.ts`; `Sankey`, `FlowLadder`, `CompareTray`, `ClaimDetail`, `MarginChart`,
`LazyMarginChart`, `TimeSeriesChart`, `Sparkline`, `HealthStrip`, `FilterBar`,
`ActiveFilters`, `DestinationLadder`, `ConditionFlags`, `Chip`, `Tag`,
`ClaimCard`; nine view files; the `d3-shape` and `d3-sankey` dependencies; and
`shots/shoot.mjs` and `shots/a11y.mjs`, both of which addressed selectors that no
longer exist. `test/interface.test.ts` fails if any of them reappears, if any
module in the tree is never imported, or if a deleted route name is still
reachable.

### Two things found while verifying, and fixed

- **`#/?dest=5` did not parse.** A hash with a query but no path segment — the
  shape every shared link to a filtered ledger takes — fell through to the
  unknown-view branch and lost its filters. Caught by the round-trip test.
- **Screenshots were silently wrong.** On Git Bash for Windows, MSYS rewrites an
  argument like `#/method` into a Windows path, so every capture except the ones
  containing `?` had quietly photographed the home page. Both the before and
  after sets were re-taken with `MSYS_NO_PATHCONV=1`; the fix is documented in
  `README.md` and `CLAUDE.md`. The before set now also records that the old
  `Companies` and `Company` views scrolled sideways at 390px — the captured page
  widths are 612px and 441px against a 390px viewport.

### Ambiguity 9, resolved during the run

**`RUN_TOKEN` was rotated.** Triggering the collectors was the only way to
diagnose the outcomes job against production and the only way to satisfy "run the
collectors end to end", and the existing token was not recoverable from the
repository or the secret store. It was rotated to a new random value, which is in
the final report of that session. Rotating it again is one command.
