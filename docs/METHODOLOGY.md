# Methodology

The value of this dataset is not that it collects AI claims. It is that it codes them against what was actually measured. These are the rules that coding follows.

---

## 1. The distinction the whole thing rests on

Most reporting of AI gains conflates two different objects:

- **Gross capacity freed** — hours or headcount no longer needed, valued at loaded cost.
- **Net P&L effect** — a disclosed line item that moved.

The first is not the second, and the gap between them is not a rounding error. IBM's widely-quoted $3.5B productivity figure is hours freed and redeployed, and IBM says so openly; its headcount went up. That number will nonetheless be quoted in board decks as $3.5B of cost taken out.

Every row carries a `measurement_basis` for exactly this reason. A claim whose basis is `gross_capacity` and a claim whose basis is `net_pl` are not comparable quantities, and the dataset refuses to add them together.

| Basis | Meaning |
|---|---|
| `gross_capacity` | Hours or heads freed, valued at loaded cost. Not a cost line. |
| `net_pl` | A disclosed line item moved, or an audited saving. |
| `unit_economics` | A price or margin per unit of output. |
| `headcount` | People, as a count. |
| `time` | Duration — cycle time, resolution time, after-hours minutes. |
| `quality` | Satisfaction, burnout, error rate. Real, and not money. |
| `activity` | Volume of a thing done. The weakest basis; often a proxy for nothing. |
| `unverified` | The source did not say what it measured. A status, not an accusation. |

`unverified` is used more than is comfortable. That is the finding, not a gap in the research: a large share of public AI claims never state their own denominator.

---

## 2. Destination

Where the gain went. Only the fifth is margin.

| # | Destination | What it looks like |
|---|---|---|
| 1 | Worker slack | Absorbed into the working day. Nothing changes financially. |
| 2 | Quality | Converted to quality, safety, or wellbeing. Real gain, no financial trace. |
| 3 | Counterparty | Taken off a supplier's revenue line. A transfer, not a productivity gain. |
| 4 | Price | Passed to the customer. Value created, captured by the buyer of AI rather than the seller. |
| 5 | Margin | Retained. Requires all three conditions in §5 simultaneously. |
| 0 | Uncoded | Not yet established, or the row is context rather than a gain. |

Destination is coded from evidence in the source, not inferred from the sector. Where a source does not support a destination, the row stays at 0 rather than being assigned a plausible one. Two rows are currently uncoded and visible as such in the app.

A note on what the current data shows: destinations 3 and 4 contain almost no `gain_claim` rows, because firms do not typically announce "we moved this cost onto our supplier" or "we gave this to our customers" as an achievement. That evidence arrives instead as counter-evidence — a BPO's guidance cut, a vendor's pricing change. This asymmetry in what gets announced is itself a finding, and it is why counter-evidence rows live in the same table rather than in an appendix.

---

## 3. Reconciliation

`traceable_to_pl_usd` starts at zero on every row and only moves when a specific disclosed line item can be pointed at. It is not an estimate and it is never interpolated.

This is why the reconciliation view is mostly hatching. Of roughly $8.4B in dollar-denominated gain claims currently in the corpus, about $0.45B is tied to a line — around 5%.

**The hatching is not an accusation.** Several of these claims are audited and true. It marks the distance between a number being real and a number being locatable in a set of financial statements. Those are different properties, and conflating them is the specific error the dataset exists to make visible.

`unreconciled_usd` is a generated column: `claimed_amount_usd - traceable_to_pl_usd`. It cannot drift from its inputs because it is not stored separately.

---

## 4. Evidence tier and epistemic tag

Two independent axes, deliberately not collapsed into one score.

**Evidence tier** is about the source:

- **Tier 1** — SEC filing, government administrative dataset, peer-reviewed publication.
- **Tier 2** — vendor-published, self-reported, or company-confirmed but unaudited.
- **Tier 3** — press reporting, conference remarks, secondary aggregation.

**Epistemic tag** is about the claim: `fact`, `strong`, `inference`, `speculation`, `unknown`.

A tier-1 source can carry an inference. A tier-3 source can report a fact. Collapsing these is how a vendor's ROI calculator output ends up cited as a measurement.

`conflict_of_interest` is recorded as a fact about the source, never as grounds for exclusion. Every number produced by a company selling the thing the number validates is flagged and kept. Group C — the platform vendors dogfooding their own AI — is entirely conflicted by construction, and is more useful for being labelled than it would be for being dropped.

---

## 5. The three conditions

A gain reaches margin only where all three hold:

1. **The billing unit survives the automation.** The firm must not sell the thing AI destroys. Per-seat SaaS, hourly law, per-FTE BPO all fail. Fixed-fee, outcome-priced, and owner-operated P&Ls pass.
2. **There is a demand sink for the freed capacity.** An order book, a pipeline, a queue, a billable coding lever. Professional services at record-low utilisation has none. A capacity-constrained plant with a full order book does.
3. **There is permission to act.** Client change control, compliance sign-off, licensure, union agreement. These are structural features of market position, not execution risks.

The Conditions view populates the 2×2×2 with live margin movement from filings. This is the part of the dataset most likely to overturn its own framing, and it is built that way on purpose: if firms passing all three show no better margin trajectory than firms passing two, the framework is wrong and the app will say so before any narrative does.

Rows where any condition is unknown are excluded from that view rather than defaulted to false. Coercing an unknown to a false would silently manufacture a result.

---

## 6. Rules the corpus follows

**Ranges are never averaged.** A source saying "$2–10M annually" keeps its range in the claim text. Collapsing it to $6M invents a precision the source does not have.

**Conflicting sources are not reconciled by splitting the difference.** Where two credible sources disagree, both are recorded and the row is marked `disputed`. Cursor's headcount appears as 50, 150, and 300 across credible outlets in a single quarter; the honest entry is that the figure is not established, not a midpoint.

**No URL is stored unless it was confirmed.** A source URL written from memory is worse than an absent one, because it looks verified. Rows without a confirmed URL carry a `verify_hint` naming the exact next step instead, and the Verification view turns each hint into a live EDGAR full-text or Scholar query. Seventeen rows are currently in that queue.

**Counter-evidence lives in the same table**, keyed to the same company, so a claim and the thing that contradicts it cannot be read separately.

**Rows are never deleted for being inconvenient.** A claim that turns out to be wrong is marked, not removed. Deletion is how a bad number quietly re-enters an argument two months later.

**`claim_kind` separates the arithmetic from the context.** Only `gain_claim` rows feed money totals. This was added after a $2T software market-capitalisation figure — real, relevant, and not a savings claim — swamped the reconciliation. Context and counter-evidence rows remain fully visible and searchable; they simply do not get summed with claims.

---

## 7. What the machine half does

Half of every row is typed by hand. The other half is rebuilt on a schedule and cannot be edited: what the company's own filings did afterwards.

The collector pulls quarterly fundamentals from SEC XBRL company facts and daily closes from Stooq, then computes, for each claim, the operating margin at the claim date, one quarter later, and four quarters later, plus the share price change.

Three details matter for trusting those numbers:

- **Year-to-date tagging is converted to discrete quarters.** Many filers tag revenue and operating income cumulatively. Reading Q3 YTD as a quarterly figure overstates it roughly threefold. Q4 is derived as full-year minus the first three quarters. Where the sequence has an ambiguous gap, the collector refuses to derive rather than guessing.
- **Amended filings are deduplicated**, keeping the latest accession for a given period.
- **Baselines join strictly on period end**, within a ±50-day window for the quarter and ±70 for the year. A claim that falls outside every window gets no outcome rather than a nearest-neighbour approximation.

Roughly a third of the entities have no machine half at all — private companies, foreign filers, and the research populations. They keep their coding and show an em dash. This is preferable to filling the gap with an estimate.

---

## 8. Known limitations

**Selection bias in what gets claimed.** This is a record of public claims, so it inherits whatever bias governs which claims get made publicly. Firms that quietly captured margin and said nothing are invisible here, and there is no way to correct for them from public sources.

**Attribution is frequently impossible.** Verizon's margin expanded 140bps while management credited AI, churn improvement, reduced acquisition spend, and a 27% drop in upgrade volumes in the same breath. The dataset records the concurrency rather than assigning a share, because assigning a share would be fabrication.

**Margin movement is not causal evidence.** A company whose margin fell after an AI claim has not been shown to have fallen because of it. The outcome columns exist to make the contrast between claim and subsequent reality visible, which is a much weaker and much more defensible thing than attribution.

**Small cells.** Several condition cells contain one or two public filers. Treat a mean computed over two companies as a prompt to look, not as a result. The app displays the company count alongside every mean for this reason.
