# AI Outcome Ledger

A maintained public record of every public claim of an AI productivity gain, coded against what was actually measured, what happened to the claimant's margin afterwards, and whose revenue line paid for it.

Not a report. Half of it is typed by hand and half rebuilds itself on a schedule from SEC filings, which is what makes it a record rather than a snapshot.

**→ [SETUP.md](SETUP.md) to deploy it.** Written from absolute zero: it installs the tools, creates the accounts, and offers a path that needs no Git or GitHub at all. About an hour, $0, no credit card.

---

## The problem it exists for

Everyone reports AI use-case gains. Almost nobody can point to the line item. The gap is usually treated as a mystery or as evidence that AI does not work. It is neither — it is that the gain lands in one of five places and only one of them is margin.

The claims are mostly true. They are just not the quantity people think they are:

- **IBM** reports $3.5B in productivity savings against a $2B target. That is hours freed, valued at loaded cost, redeployed rather than removed. Headcount went up. It is not a cost reduction, and IBM says so.
- **Klarna** told analysts the AI agent had saved $60M. In the same quarter, customer service and operations cost $50M, up from $42M a year earlier. The saving was real and was consumed by volume growth and quality remediation before it reached the P&L.
- **JPMorgan** runs the best-resourced AI programme in global finance. Dimon: roughly $2B of benefit against $2B of expense. Break-even.
- **Verizon** posted its highest-ever adjusted EBITDA margin and credited AI, churn improvement, lower acquisition spend, and a 27% drop in upgrade volumes in the same breath. How much was AI is not knowable, including by Verizon.

Four cases, four different reasons the number does not mean what it appears to mean. There are hundreds. This is the table that holds them.

---

## What it currently contains

**84 coded claims across 45 entities**, seeded and verified.

| Row kind | Count | What it is |
|---|---:|---|
| `gain_claim` | 32 | A firm claiming a gain |
| `counter_evidence` | 16 | Something that moved the other way |
| `context` | 15 | Relevant, not a savings claim |
| `research_finding` | 15 | Study or population-level result |
| `pricing` | 6 | Pricing-model evidence |

**The headline: $8.39B in dollar-denominated gain claims. $0.45B tied to a disclosed line. About 5% reconciled.**

Where the gains landed, gain claims only:

| Destination | Claims | Claimed | Unreconciled |
|---|---:|---:|---:|
| 1 · Worker slack | 10 | $4.15B | $4.15B |
| 2 · Quality | 5 | — | — |
| 5 · Margin | 15 | $3.58B | $3.13B |
| 0 · Uncoded | 2 | $0.67B | $0.67B |

Destinations 3 (counterparty) and 4 (price) hold almost no gain claims — firms do not announce "we moved this cost onto our supplier" as an achievement. That evidence arrives as counter-evidence instead: a BPO's guidance cut, a vendor's repricing. **The asymmetry in what gets announced is itself a finding**, and it is why counter-evidence sits in the same table rather than an appendix.

Evidence quality is on the face of every row: 34 verified against a primary source, 17 in the verification queue with the exact next step attached, 2 disputed.

---

## The five destinations

Only the fifth is margin.

1. **Worker slack** — absorbed into the working day. Nothing changes financially.
2. **Quality** — converted to quality, safety or wellbeing. Real gain, no financial trace. Ambient clinical scribes are the purest case: large, well-measured, and it lands entirely in clinician burnout because the appointment book, not documentation speed, sets the schedule.
3. **Counterparty** — taken off a supplier's revenue line. A transfer, not a productivity gain; it nets to roughly zero in aggregate.
4. **Price** — passed to the customer. Captured by the buyer of AI, not the seller.
5. **Margin** — retained. Requires all three conditions at once: the billing unit survives the automation, there is a demand sink for the freed capacity, and there is permission to act on it.

---

## Views

**Reconciliation** — every dollar claim on one shared scale. Solid green is the portion tied to a disclosed line; hatched red is the rest. The shape of the page is the argument.

**Ledger** — the full record, sortable, each row expanding to its coding, its source, its verification state and its margin series with the claim date marked.

**Destinations** — five columns. Watching the first four fill is the fastest way to see why use-case gains and EBIT impact are different questions.

**Transfers** — a bipartite map of who claims the saving against who absorbs the loss, edge weight by identified amount. If a thesis depends on a firm converting AI capacity into margin, this is the map of whose revenue line it comes from.

**Conditions** — the 2×2×2, populated with live margin movement from filings. This is the view most likely to overturn the framing, and it is built that way deliberately: if firms passing all three conditions show no better trajectory than firms passing two, the app will say so before any narrative does.

**Verification** — what still needs a primary source, each with its next step turned into a one-click EDGAR full-text or Scholar query.

**Add a claim** — public inlet. Submissions land in a separate table nobody but you can read, and promotion stays manual because the coding is the value.

**Method** — the coding rules, in the app, because a taxonomy nobody can see gets applied inconsistently within a month.

All eight share one filter object. Filtering the transfer map and switching to the ledger shows the same subset — that continuity is the difference between a tool for finding connections and eight separate charts.

---

## Architecture

```
supabase/     Postgres schema, RLS policies, seed data (4 files, run in order)
worker/       Cloudflare Worker: scheduled SEC XBRL + Stooq collector
web/          React + Vite frontend for Cloudflare Pages
docs/         Methodology and data dictionary
```

**Data sources are keyless and free.** SEC EDGAR company facts for quarterly fundamentals, Stooq for daily closes. No API keys, no paid tier, no vendor dependency for the half of the dataset that has to stay honest.

**Why a collector at all:** "what happened to margin afterwards" is the column most likely to rot if typed by hand, and the one that does the most work. Machine-maintaining it means it cannot quietly go stale while the rest of the table looks current.

Three things in the collector matter for trusting the numbers:

- **Year-to-date tagging is converted to discrete quarters.** Many filers tag cumulatively; reading Q3 YTD as a quarterly figure overstates it roughly threefold. Q4 is derived as full year minus three quarters, and where a sequence has an ambiguous gap the collector refuses to derive rather than guessing.
- **Amended filings are deduplicated**, latest accession wins.
- **Baselines join strictly on period end**, ±50 days for the quarter and ±70 for the year. A claim outside every window gets no outcome rather than a nearest-neighbour approximation.

CIKs are resolved at runtime from the SEC's own ticker map rather than hardcoded, because a wrong CIK does not error — it silently returns another company's financials.

---

## Testing

| Suite | Tests | Command |
|---|---:|---|
| Worker | 74 | `cd worker && npx vitest run` |
| Web | 51 | `cd web && npx vitest run` |

Both typecheck clean (`npx tsc --noEmit`). The production build succeeds; the chart library is split into its own chunk so the ledger paints before recharts loads.

The four SQL files were executed against a real Postgres 16 instance from a clean schema, in order, and are idempotent — safe to re-run from the top. Verified: 84 claims load, all three views return correct aggregates, and `claim_outcomes` joins through to both `v_ledger` and `v_condition_cells`.

The collector's network calls could not be exercised from the build environment, so the SEC and Stooq paths are covered by unit tests against captured response shapes rather than live fetches. First real run is step 2.6 of SETUP.md, and `fetch_runs` records exactly what happened.

---

## Two things worth your judgement, not mine

**The Amazon and CBA rows are coded from press aggregation.** I declined to carry a headcount figure into the Amazon row at all; its `verify_hint` says to take it from the 8-K. Both are in the verification queue.

**The Long Lake / Amex GBT row is the highest-value single verification in the set.** Post-close segment disclosure would be the first independently auditable AI-retrofit margin data that exists. Every operating figure in that group is currently self-reported by private companies with active fundraising, including a $100M unaudited EBITDA claim. The moment that entity carries public disclosure obligations, an entire group in this dataset becomes verifiable for the first time.

---

## Licence and use

The coding is a judgement layer over public statements. Every row carries its source, its evidence tier, and its epistemic tag so you can disagree with a specific call rather than the dataset as a whole. Export any filtered selection to CSV from the toolbar.

If a row is wrong, the useful correction names the `ref`.
