# Threshold Ledger — repurposing the AI Outcome Ledger

This is a **brownfield repurpose**, not a greenfield build. An existing, deployed
application is being pointed at a different thesis. Most of the stack survives. The
subject, the data model, and the epistemic contract do not.

Read this whole file before asking anything. Then run the interview.

---

## 0. Pre-flight (do this before the interview, and write it down)

Do not propose a single change until you have produced `planning/00-inventory.md`
containing:

1. Every table in the Supabase schema, its columns, and every CHECK constraint verbatim.
2. Every route and page component in the Vite/React app, one line each.
3. **A design-token extraction**: every color, font stack, font size, weight, letter-spacing,
   border width, radius, and spacing value actually used in the current codebase, read out
   of the source — not guessed, not "typical values." Cite the file and line for each.
4. What the Cloudflare Worker cron currently fetches, on what schedule, and where it writes.
5. A list of anything you could not determine from the code.

Item 3 is the one that matters most. The current visual identity is the constraint that
prevents this from becoming a generic AI-generated website, and you cannot honor a system
you have not read.

---

## 1. What exists

- Supabase Postgres 16.
- Cloudflare Worker on cron: SEC XBRL filings + Stooq price data.
- React 18 + Vite 5 + TypeScript on Cloudflare Pages.
- Recharts.
- IBM Plex Mono / Sans Condensed / Serif.
- Audit-workpaper visual style.
- Tables: `companies`, `claims`, `observations`, derived outcomes, fetch log, public submissions.
- Controlled vocabularies enforced with **CHECK constraints, not enums** — deliberately, so
  new vocabulary values do not require a migration. Preserve this decision everywhere.

The old product tracked verified corporate AI-productivity claims, coded by measurement
basis, destination, and reconciliation to the P&L.

## 2. What it becomes

A proof-of-concept for a narrower thesis:

> AI has collapsed the cost of localization far enough to make hyperlocal and niche-language
> content and services economically viable for the first time — even though the broader
> language-services industry has simultaneously hit a demand ceiling.

The structure rhymes with the old one:

| Old | New |
|---|---|
| companies | niches |
| claims | opportunity cases |
| verdict | threshold status |

**The lineage is not incidental and should be stated in the product itself.** The old
ledger's central finding was that in commoditized cognitive services, AI's surplus passes
through to buyers rather than being captured as vendor margin. That finding is the *premise*
of this one: surplus flowing to buyers is precisely the mechanism that turns a previously
unaffordable buyer into a viable one. The new app is the second half of the same argument.

## 3. The epistemic contract — the hardest requirement

The old app derived verdicts from filed financial disclosures. This one does not. This is an
**argued conviction supported by assembled evidence**, and it must never render as more
measured than it is.

This cannot be handled with a footer disclaimer. It has to be structural:

- **No bare numbers.** Every displayed figure renders through a single component that takes a
  mandatory evidence-tier prop. Make it a TypeScript type error to render a number without one.
  If a developer can print `{value}` directly into JSX, the design has failed.
- **Four tiers**, stored in a CHECK-constrained vocabulary column:
  - `observed` — primary source, independently verifiable, linkable.
  - `reported` — a named third party's claim (vendor, press, analyst). Source named inline.
  - `estimated` — derived by this project's own model. The formula must be viewable.
  - `asserted` — the author's judgment. No external support. Say so.
- **A global tier filter that is allowed to gut the page.** When a reader sets it to
  `observed only`, whatever collapses, collapses — visibly, with the emptied regions left in
  place rather than reflowed away. That collapse is the most credible thing the product does.
  Do not soften it.
- **Retire the word "verdict."** Status vocabulary: `dormant`, `threshold crossed`,
  `contested`, `contradicted`. Status is reversible and every change is logged with a date and
  a reason, surfaced in the UI.
- Preserve the fetch log and public submissions. Submissions from readers enter at
  `reported` at best, never higher, and are visibly queued rather than silently merged.

## 4. Domain model

Migrate, don't drop. The old tables keep their data; the new ones are additive.

- `niches` — a bounded market defined by language/region/content-type/service-type. Needs a
  willingness-to-pay estimate and a cognitive-unit-cost estimate, both tiered, both with an
  explicit uncertainty range. Point estimates without ranges are forbidden.
- `opportunity_cases` — a specific instance argued to sit inside a niche.
- `evidence_items` — replaces the role of `observations`. Tiered, sourced, dated.
- `threshold_assessments` — replaces derived outcomes. Produces the status, shows its inputs.

Every vocabulary stays a CHECK constraint. Every assessment records which evidence items it
consumed, so a status can be traced back to sources without leaving the app.

## 5. The unresolved question the app has to hold open

The thesis has a strong internal objection and the product is more credible if it foregrounds it:

The cost collapse is documented mainly in **high-resource** language pairs. Benchmark
literature shows severe quality degradation in genuinely low-resource languages, and the
scarcity of qualified reviewers in those languages makes the human verification complement
*more* expensive, not less. So the market the thesis claims is activating may be exactly the
market where the cost collapse is weakest.

There are therefore two distinct claims that must never be merged in the UI:

- **Long-tail content** in already-served languages — cheap now, well supported.
- **Long-tail languages** — contested, and the interesting case.

A niche record must be classifiable as one or the other. If a reader cannot tell which claim a
given status supports, the product is lying by structure.

## 6. Design mandate

The current identity is **audit workpaper**. Not "editorial." Not "broadsheet." A workpaper
has a real vernacular: cross-reference indices (A-1, B-2, C-4), tickmarks that mean specific
verification actions, footing and cross-footing marks, preparer/reviewer initial blocks,
source annotations in the margin, lead schedules that roll up to a summary. Use that
vocabulary literally — a status marker should be a tickmark with a defined meaning in a legend,
not a colored pill.

Motion reference points are **motion.dev** and **reactbits.dev**, but take only the
*discipline* from them, not the aesthetic. Those sites are dark, saturated, developer-tool
maximalist. Stapling their components onto a workpaper produces incoherence. What is worth
borrowing:

- Spring easing, never linear or `ease-in-out` defaults.
- Scroll-linked state where the reading column stays pinned and the evidence beside it changes.
- Staggered row reveal on tables, 20–30ms per row, once, not on every scroll.
- Numeric transitions that use `tabular-nums` so nothing reflows mid-animation.
- One orchestrated moment, not scattered effects.

Everything else on the page is static.

### The signature element

One interaction carries the entire thesis. Build it well and keep everything around it quiet.

A **threshold sweep**: a vertical cost axis (cost per cognitive unit, log scale). Each niche is
a tick on that axis, positioned at its willingness-to-pay, drawn as an interval rather than a
point because the estimate is uncertain. A horizontal cost line descends as the reader scrolls
or drags through time. As the line passes through a niche's interval, that niche moves from
`dormant` toward `threshold crossed` — and while the line is *inside* the interval, the niche
renders as `contested`, because the honest answer is that we do not know.

The uncertainty band is the point. A version of this that draws point estimates is wrong even
if it looks better.

### Banned outright

Reject any of these on sight, including from yourself:

- Purple/indigo → pink gradients. Any gradient used as decoration.
- `rounded-2xl` cards with drop shadows floating on a gray background.
- A centered hero with an `<h1>` and two CTA buttons.
- Feature grids of icons inside colored circles.
- Emoji anywhere.
- "Trusted by" logo strips, testimonial cards, pricing tables.
- Inter, system-ui, or any fallback drift away from IBM Plex.
- Border radius above 2px.
- Elevation/shadow used where a 1px hairline rule would do.
- Any number rendered without tabular figures.
- More than two accent colors. One for `threshold crossed`, one muted for `contradicted`.
  Everything else is ink on paper.

### Order of work — non-negotiable

The design split executes **first**, and its deliverable is a **static reference page at
`/style`, populated with three real niche records and their real evidence**, showing: the type
scale, the tickmark legend, an evidence-tier chip in all four states, a populated data table,
one threshold-sweep frame, and the empty state produced by filtering to `observed only`.

That page gets human review and sign-off **before any application screen is built**. Do not
build screens and retrofit a design system onto them. That sequence is what produces generic
output, and it has already happened once on this project.

## 7. Splitting guidance

Prefer more splits over fewer. Likely units, in dependency order — challenge this during the
interview if you disagree:

1. Design system + `/style` reference page (blocking; nothing else starts until sign-off).
2. Schema migration + evidence-tier enforcement primitives.
3. Data collection: what replaces the SEC/Stooq worker, and whether the old cron keeps running.
4. Niche and opportunity-case authoring + review surfaces.
5. Threshold sweep + the reading experience.
6. Public submissions and the tier-gated intake queue.

## 8. Out of scope

Auth beyond what exists. Payments. Multi-tenancy. Mobile app. Deleting the old ledger's data
or routes. Anything the interview surfaces that does not serve the thesis above.

## 9. Acceptance criteria

- A reader can reach `observed only` in two clicks and watch the page empty out.
- No number appears anywhere without a tier and, where applicable, an uncertainty range.
- Every status traces to its evidence without leaving the app.
- Nothing in the UI implies these statuses were derived from filed financial disclosures.
- The `/style` page and the shipped screens are visibly the same product.
- `prefers-reduced-motion` yields a genuinely designed static version, not a broken one.
