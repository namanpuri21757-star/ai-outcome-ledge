# AI Outcome Ledger — project instructions

Read this before touching anything. Every session starts cold; this file is the
memory.

---

## What this is

A maintained record of every public claim of an AI gain, coded against what was
actually measured. Half hand-coded, half machine-maintained.

**The single job:** let a reader see the distance between a number being *real*
and a number being *locatable in a financial statement*.

**The output test:** after using this, a reader can name specific companies whose
AI gains did or did not reach profit, and say why. If a change does not help with
that, it is not a feature.

---

## Stack and deploy

| Piece | Where | Notes |
|---|---|---|
| Frontend | `web/` — Vite + React 19 + TypeScript | Deployed to Cloudflare on push to `main` |
| Collector | `worker/` — Cloudflare Worker, cron | Deployed with `npx wrangler deploy` from `worker/` |
| Data | Supabase Postgres | Schema in `supabase/`, run in the SQL editor |

Frontend reads the `v_ledger` view at runtime with the anon key. RLS limits anon
to reading published rows and inserting a submission.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are **build-time** variables in
the Cloudflare dashboard. Changing them requires a new deploy, not just a save.

**Never put the service-role key anywhere in `web/`.** It belongs only in the
Worker's Cloudflare secret store.

---

## Before you commit — the gate

Run all four. Do not push if any fails.

```
cd web    && npx tsc --noEmit && npm test && npx vite build
cd worker && npx tsc --noEmit && npm test
```

Expected: **331** web tests, **102** worker tests, both typechecks silent, build
clean.

**Look at the screens before you call a UI change done.** The app renders
against generated rows with no database:

```
cd web && VITE_FIXTURES=1 npx vite --port 5199   # in one shell
cd web && npm run shots && npm run a11y          # in another
```

`npm run shots` writes every view, plus mobile and empty states, to
`shots/out/` (git-ignored) and fails on a console error. `npm run a11y` checks
what a screenshot cannot: that tab reaches the flow diagram, that Enter on a
node holds it and the diagram visibly says so, that Escape lets go, that a held
node and a pin both survive a reload, that a narrow screen never scrolls
sideways, and that nothing transitions under reduced motion. The fixtures are synthetic and clearly labelled; they are
behind `import.meta.env.DEV`, so production builds drop the module entirely.

`npm test` in `worker/` never touches the network. The live check is separate
and deliberate:

```
cd worker && npm run smoke
```

It asks Stooq for one known-good symbol and fails with the real diagnosis if the
answer is not parseable CSV. Run it before a Worker deploy and whenever the
collector reports a source-level failure. It is not in the gate on purpose: a
gate that goes red because a third party is having a bad afternoon stops being
read.

If a test fails, fix the code — not the test. A test only changes when the
behaviour it describes was deliberately changed, and then the commit message
says so.

---

## Architecture rules

**One vocabulary file.** Every user-facing label lives in `web/src/lib/labels.ts`
and nowhere else. Never write a destination name, a basis name, or a condition
name as a string literal in a component. Two copies drift.

**Database codes never reach the interface.** `destination` is stored 0–5 and
rendered as position on a five-step ladder, because a leading numeral reads as a
quantity when it is a rank. Codes survive in the CSV export and each row's fine
print. If you find yourself printing a raw code, stop.

**Generated, not typed.** Every sentence on the findings page and every company
verdict is assembled from the rows at render time. Never write prose that states
a fact about the data — it goes stale silently and this is a project about
numbers being checkable. If a query returns nothing, say so; never fall back to
copy describing data that is not there.

**Only `gain_claim` rows enter money totals.** A $2T market-cap figure, a $6.3B
acquisition and a $60M saving are different objects. Summing them makes the
headline meaningless. `totals()` in `filters.ts` enforces this; do not bypass it.

**Nulls are a real state.** A missing margin delta is not zero and not the
smallest value — it sorts last in both directions, and renders as an em dash.
An uncoded condition is not "not met". Never coerce.

**Pure logic lives in `web/src/lib/`, out of components,** so it is testable
without a browser. New logic goes there with tests, not inside a `.tsx`.

**One scale for every bar.** `max` is computed once in `App.tsx` and threaded
down, so two reconciliation bars in different views stay comparable.

**Every size is a rung on one ramp.** `--t-2xs` … `--t-3xl` in `styles.css`,
anchored at 14px with a ratio of 1.2, plus a 4px spacing scale (`--s-*`) and
two motion tokens. Never write a raw `px` font-size in a rule; sizes a pixel
apart read as noise rather than as hierarchy.

**Labels cannot overlap by construction, not by tuning.** `lib/flowLayout.ts`
makes the gap between two Sankey nodes equal to the height of one node label,
so two labels cannot meet however thin the lanes get, and the number of named
lanes is then whatever that gap allows in the height available. `NAME_SIZE` and
`VALUE_SIZE` there must stay equal to `.flow-node-name` and `.flow-node-value`
in the stylesheet.

**A column name is written once.** `LedgerView` and `CompaniesView` each hold a
`COLUMNS` map used both for the header cell and for the `data-label` the cell
carries when the layout stacks on a narrow screen. CSS reads it with
`attr(data-label)` — never hard-code a user-facing name in a stylesheet.

**No view may scroll sideways to reach its answer.** Below their breakpoints
the flow diagram becomes a ladder (`FlowLadder`), and the ledger table and
company list become stacked blocks. Dropping columns instead is not an option:
the ones that fall off the right-hand edge are always the ones carrying the
reconciliation.

**The selection lives in the URL, not in a `useState`.** `route.ts` serialises
`Filters` and the pinned companies into the hash, and `App.tsx` reads them back
out of `parseHash`. Every state of this app is therefore a link, and browser
back steps through selections. Never reintroduce a local filter state: two
sources of truth for the selection is how a filter survives one click and not
the next. Only non-default values are written, so a clean view keeps a clean
URL.

**One ladder order, used everywhere.** `DESTINATION_ORDER` in `labels.ts` is the
only ordering of destinations. The flow diagram reads top-to-bottom in it and
the pattern grid stacks its groups in it. If position means one thing in one
view and another elsewhere, position stops meaning anything.

**The flow diagram is the reconciliation bar unrolled, not a second visual
language.** Ribbons resolve into the same solid green and the same 45° hatch the
bar uses. `MIN_WIDTH` in `Sankey.tsx` must equal `.flow-svg { min-width }` — the
layout is computed from the measured width, so if CSS stretches the element past
what was measured, every label lands in the wrong place.

---

## Design system — do not renegotiate

Cool ledger paper, not warm cream. The subject is audit.

```
--paper #edf0f3   --paper-raised #f7f9fa   --paper-sunk #e2e7ec
--ink #111a22     --ink-2 #46555f          --ink-3 #7c8b97
--rule #c9d2d9    --rule-strong #a5b3bd
--traced #146b52  --claimed #2c5c8c        --gap #a8391f
--transfer #8a6420 --quality #5b4a86
```

IBM Plex Sans Condensed (structure) / IBM Plex Serif (claims, so they read as
quoted disclosure) / IBM Plex Mono (every number, so columns align).

**Signature element:** the gap bar — solid green traced, diagonal-hatched red
untraced. It is the argument. Do not restyle it, do not replace it with a
progress bar, do not add rounded corners.

Zero border radius throughout. No gradients. No emoji.

---

## Voice

Plain declarative sentences. Name things by what a reader controls, not by how
the system is built.

**Banned constructions:** "not simply X — it is actively Y", "oscillates
between", "delve", "leverage" as a verb, "seamless", "robust", abstract
nominalizations, invented jargon. Nobody talks like that and readers notice.

"Not traceable" must **always** carry the clarification that it does not mean the
claim is false. Several of these claims are audited and true.

---

## Known state

- **React 19, and no chart library.** Recharts pinned the app to React 18 and
  was drawing the margin series twice, with the two call sites disagreeing
  about whether margin was a ratio or a percentage. `components/TimeSeriesChart`
  now draws it once, with the scale and tick arithmetic in `lib/chart.ts`.

- **Astryx was evaluated and rejected on measurement, not taste** (2026-08-15).
  It is real, MIT, and its type-scale methodology is what this project's ramp
  is modelled on. But it needs React 19 *and* StyleX, and one `Button` costs
  +131 kB of CSS and +136 kB of JS, because `astryx.css` is a static stylesheet
  for the whole system that cannot be tree-shaken — carrying visual defaults
  this design would then override. shadcn/ui was rejected for the same shape of
  reason: it would import Tailwind alongside a hand-authored token system to
  solve problems that were layout and encoding problems, not component
  problems. If this is revisited, re-measure rather than re-reason.

- **The Worker does not deploy on push, and drifting behind `main` is the
  failure mode to check first.** The pagination fix below sat committed and
  undeployed for a day while the interface showed the symptoms it had already
  fixed, and the warning text on screen was the giveaway: it did not exist
  anywhere in the source tree. When production behaviour contradicts the code,
  run `npx wrangler deployments list` in `worker/` and compare the last
  `Source: Upload` against `git log -- worker/` before diagnosing anything else.

- **Stooq stopped serving automated clients (observed 2026-08-15).** Every
  symbol now returns HTTP 200 with a JavaScript proof-of-work interstitial —
  it hashes a challenge, posts a nonce to `/__verify`, and reloads. It is
  served on the first request, on both stooq.com and stooq.pl, with or without
  a User-Agent, so it is not a rate limit, not a changed URL, and not a wrong
  ticker. The parser now classifies it as `challenge`, `runPrices` stops at the
  first one and reports it once, and `npm run smoke` checks it on demand.
  **Price history is frozen until a price source is chosen; margins come from
  SEC XBRL and are unaffected.** Do not "fix" this by solving the challenge —
  it is the site declining automated access, and the answer is a different
  source, not a workaround.

- **Prices are off the schedule, not deleted** (`PRICES_ON_SCHEDULE` in
  `worker/src/index.ts`). A daily run would only ask a closed door twenty times.
  The job is kept, tested and reachable at `/run?job=prices`, and `price_close`
  stays in `OUTCOME_SERIES` so the observations collected before the wall went
  up still produce outcomes — "Share price, one year" still reads for the claims
  that have it. Wiring a new source means one `fetchPrices` implementation and
  flipping that flag back.

- The collector's outcomes job was writing zero rows because `Db.select` issued
  unbounded requests and PostgREST silently truncates over-cap responses with
  HTTP 200. Fixed with explicit `Range` pagination. If margins are still blank,
  read `fetch_runs.notes` — the job now reports which branch it took and how
  often.
- Teleperformance, Klarna and CBA do not file with the SEC. No margin series is
  possible for them. This is expected, not a bug, and must not be reported as a
  warning. Enforced in code: the collector tags these with `expected: true` on
  the `RunError` (a jsonb field, not a schema change), `ok` ignores them, and
  the health strip lists them under "expected, and not a fault" rather than
  beside real problems.

---

## Working preferences

- Diagnose before proposing. Root cause, then fix. Never guess-patch.
- If a fix fails twice, the constraint is on the wrong element — usually a parent
  container. Change the target, not the number.
- Push back once on a request with a structural problem, then implement as
  instructed and note the disagreement in one line. Do not relitigate.
- Never invent a citation, URL, statistic, or company fact. If a source is
  needed and unverified, leave it null and write the next step into
  `verify_hint`.
- Keep chat replies short. The work is the deliverable.
