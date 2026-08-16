# AI Outcome Ledger — project instructions

Read this before touching anything. Every session starts cold; this file is the
memory.

---

## What this is

A maintained record of every public claim of an AI gain, coded against what was
actually measured. Half hand-coded, half machine-maintained.

**The single job:** a reader arrives having seen a number — "IBM saved $3.5B
with AI" — and leaves able to say whether that number appears anywhere in a
financial statement, and if it does not, which of five reasons applies.

**The output test:** after using this, a reader can name specific companies whose
AI gains did or did not reach profit, and say why. If a change does not help with
that, it is not a feature.

The current corpus is 84 rows across 45 companies and research populations. The
headline result: **$428.0M of $8.393B in claimed AI gains — 5.1% — is traceable
to a named line item in a filing.**

`REBUILD.md` holds the decision record for the 2026-08-15 rebuild: the three
candidate architectures, why the chosen one won, what was deleted, and every
judgment call made without asking. Read it before proposing a structural change.

---

## Stack and deploy

| Piece | Where | Notes |
|---|---|---|
| Frontend | `web/` — Vite + React 19 + TypeScript | `npm run deploy` from `web/`. **Not** on push |
| Collector | `worker/` — Cloudflare Worker, cron | `npx wrangler deploy` from `worker/` |
| Data | Supabase Postgres | Schema in `supabase/`, run in the SQL editor |

The frontend reads `v_ledger`, `companies` and `observations` at runtime with the
anon key. RLS limits anon to reading published rows and inserting a submission.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are **build-time** variables:
Vite bakes them into the bundle. Changing them requires a new deploy, not just a
save — and, more dangerously, *building without them succeeds*. The result is a
site that loads, renders its own chrome, and asks a hostname that does not exist
for its data. Before `npm run deploy`, confirm the values are real:

```
cd web && grep -o 'https://[a-z0-9-]*\.supabase\.co' dist/assets/*.js | sort -u
```

If that prints `YOUR-PROJECT-REF`, the build is a placeholder build. Do not
deploy it; it replaces a working site with the config-error state.

**Never put the service-role key anywhere in `web/`.** It belongs only in the
Worker's Cloudflare secret store. `test/aggregate.test.ts` and
`test/interface.test.ts` both fail if the string appears in `web/src`.

---

## Before you commit — the gate

Run all four. Do not push if any fails.

```
cd web    && npx tsc --noEmit && npm test && npx vite build
cd worker && npx tsc --noEmit && npm test
```

Expected: **353** web tests, **128** worker tests, both typechecks silent, build
clean with no warnings.

**Look at the screens before you call a UI change done.** The app renders against
generated rows with no database:

```
cd web && VITE_FIXTURES=1 npx vite --port 5199   # in one shell
cd web && npm run shots                          # in another
```

`npm run shots` takes `name=hash` pairs and writes both widths. On Git Bash,
prefix it with `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'` — otherwise MSYS
rewrites `#/method` into a Windows path, every shot silently captures the home
page, and the images look plausible while showing the wrong view.

The real check is the scripted click-through, which runs against the built
output and asserts behaviour a screenshot cannot:

```
cd web && npx vite build && npx vite preview --port 5200
cd web && npm run walk
```

100 checks at 1440px and 390px: the whole cover journey — the landing
page's locked headline, its example figures against the row they came from,
its one call to action, the blueprint's four stages and their readout, a
directory card against the company page it opens — then the finding above
the fold, cross-view total consistency, filter scope, deep-link reload,
browser back, keyboard reach, focus rings, Escape, sideways scrolling, and
zero console errors.

`npm test` in `worker/` never touches the network. The live check is separate:

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

## Architecture

Eight surfaces. Three in the nav, two reached by clicking a thing, and three
covers a visitor crosses before they know what any of it is.

```
(no hash)             the landing page — the question, one example row, the way in
#/thesis              the blueprint — what happens to a claimed dollar, drawn
#/directory           one card per company the ledger codes
#/                    the ledger — the finding, the breakdown, the readout, every row
#/claim/<ref>         one claim, fully unpacked. The only place a row is shown whole
#/company/<slug>      one company's whole record, with a generated verdict
#/method              how a row is coded and how every figure is computed
#/maintenance         collector health, the checking queue, the submission inbox
```

Ten top-level views were reduced to this. `REBUILD.md` has the kill list with a
reason per view. **A deleted view is deleted, not hidden:** its name is gone from
`ViewName`, an unknown hash lands on the ledger, and `test/interface.test.ts`
fails if any of the deleted files, imports or route names reappear.

**The three covers are dark, and the ledger is not.** `#/`, `#/thesis` and
`#/directory` are the landing page, the blueprint and the directory:
`isCover()` in `route.ts` names them, `App.tsx` renders them outside the
shell, and they share one `<CoverBar>` reading the same `NAV` list the
masthead reads. They are covers rather than reading surfaces — nothing is
coded on them and nothing is compared — which is why the ground inverts and
why the gap bar's *ground* is adapted for them in one scoped block at the
end of the stylesheet. The encoding never changes: solid green traced, 45°
audit hatch untraced, both figures written out.

The journey is landing → blueprint → directory → a company's record, and
each hand-off is one button. `lib/cover.ts` derives what the two new pages
show: `blueprint()` returns four stages whose figures come from `totals()`,
and `directoryCards()` returns one card per company with the largest claim
first. `test/cover.test.ts` fails if a figure on either page stops being a
field of what those functions return, if a term on the blueprint is defined
anywhere but `define()`, or if a company name is typed into the directory.

**The landing page is the bare root, and only the bare root.** `#/` was the
ledger before it existed and still is: every link the app writes, every shared
URL and every bookmark resolves there unchanged. `parseHash` reads the one
character of difference before the slash is stripped. `#/home` names the same
page for anyone who has to link to it. It renders outside the shell — no
masthead, no footer, its own top bar — so it is the one view that owns an `h1`,
and it is the one dark surface in the app.

### Invariants that must not be broken

**One function adds dollars up.** `totals()` in `lib/aggregate.ts` is the only
place in `web/src` allowed to sum `claimed_amount_usd` or `traceable_to_pl_usd`.
Every figure on every screen is a field of what it returns, or of what it returns
for a subset. `test/aggregate.test.ts` walks the source tree and fails if any
other file folds a money column, and asserts that destination buckets, kind
buckets and company profiles each sum to the whole across six filter states.

This rule exists because the previous build broke it: the flow diagram needed its
own arithmetic to draw ribbons, and the same screen read `$428M traceable` in the
headline and `$451M traceable` in the sidebar. Two numbers for one quantity costs
more credibility than either number buys.

**The denominator is claims that named dollars.** A claim stated as "opex down
33%" contributes nothing to a dollar total, so dollars traced against it cannot
count toward the traceable share either. `totals()` returns those separately as
`tracedOutsideDenominatorUsd`, and the interface shows them whenever non-zero.
Never fold them in, and never drop them.

**Traceable is not clamped.** A row coded with more traceable than claimed is a
research defect to surface, not an arithmetic edge to hide behind a `Math.min`.
`overTracedClaims` counts them and `GapBar` says so on the row.

**Only `gain_claim` rows enter money totals.** A $2T market cap, a $6.3B
acquisition and a $60M saving are different objects.

**Filters belong to the ledger and to nothing else.** `route.ts` refuses to
serialise filter parameters on any view but `#/`, and returns `EMPTY_FILTERS` for
any other view even when the URL carries them by hand. That is the mechanism, not
a convention: it is why a company page can no longer report "6 gain claims worth
$4.26B" beside a sidebar reading "10 rows · $4.15B". Going back restores the
selection, because the previous history entry still carries it. There is no
global sidebar and no global totals.

**One vocabulary file, and one way to define a term.** Every user-facing label
lives in `web/src/lib/labels.ts`. Every definition a reader can open comes from
`define()` in that same file, rendered by `<Term>`. There is no second copy of
any definition text in `src/`, none in the stylesheet, and no native `title`
attribute used as the only way to learn a term — `test/interface.test.ts` fails
on all three. The Method page renders `glossary()`, so a vocabulary entry cannot
exist without appearing there.

**Definitions expand in flow, never as an overlay.** `.term-body` pushes content
down. Nothing in this app is positioned over the content it explains.

**Database codes never reach the interface.** `destination` is stored 0–5 and
rendered by name. Codes survive in the CSV export and in each row's fine print.

**Nulls are a real state.** A missing figure is not zero and not the smallest
value: it sorts last in both directions, and it is written out in words rather
than rendered as a dash. `test/interface.test.ts` fails on a bare em dash in JSX.

**Every empty state states its reason.** An empty selection names the filters
responsible. An unmeasurable claim names the dates that make it unmeasurable.

**Pure logic lives in `web/src/lib/`, out of components,** so it is testable
without a browser. New logic goes there with tests, not inside a `.tsx`.

**One scale for every bar.** `barMax()` is computed from the whole corpus, not
from what is on screen, so a bar under a filter stays comparable to the same bar
without one.

**One ladder order.** `DESTINATION_ORDER` in `labels.ts` is the only ordering of
destinations, and `byDestination()` always returns all six, including empty ones
— an empty destination is a finding, not an absence.

**The signature element is the gap bar:** solid ledger green traced, 45° audit
hatch untraced, and its two figures always written out beside it. Do not restyle
it, do not replace it with a progress bar, do not add rounded corners. An
unlabelled hatched bar is not an encoding.

**No view scrolls sideways.** Enforced globally in `styles.css` and asserted by
the click-through at 390px.

**Body text is never below 16px.** `--t-sm` is the floor. No raw pixel
font-size may appear in a rule; every size is a rung on the ramp.

---

## The margin window, and why it is derived in the browser

"Does the claim show up in the financials?" is answered per claim by
`lib/outcome.ts`: the last operating margin filed before the claim, the reading a
quarter after, the reading a year after, each with its date, plus a delta and a
generated sentence saying what the delta can and cannot support. It replaced a
quarterly line chart that a reader could not get an answer from.

`claim_outcomes` has no column for "why is this blank", and the Worker writes no
row at all when a claim cannot be measured — so the interface would have nothing
to distinguish "this company does not file with the SEC" from "a year has not
passed yet" from "the collector is broken". The reason is therefore computed in
the browser from the observation coverage the anon key can already read, which is
strictly better than a stored code: the explanation names the actual date range
that exists, so a reader can check it.

**The window constants in `web/src/lib/outcome.ts` must equal those in
`worker/src/outcomes.ts`.** `test/outcome.test.ts` reads the Worker source and
fails if they drift, because the browser and the collector disagreeing about the
same claim is worse than either being wrong alone.

Current coverage: 26 of 84 rows have a one-quarter reading, 8 have a one-year
reading, 33 have a baseline. Eight is not a column, which is why there is no
margin column in the row list — each row states its measurement status in words
instead.

---

## Known state

- **Pushing to `main` DOES deploy the frontend. This file said the opposite
  until 2026-08-15; that was wrong and cost two sessions.** Workers Builds is
  connected to `namanpuri21757-star/ai-outcome-ledge` on both `ai-outcome-ledge`
  and `ai-outcome-ledge1`, with `main` → `npm run build` + `npx wrangler deploy`
  and every other branch → `npx wrangler versions upload` (a preview version, not
  production, aliased `https://<branch>-ai-outcome-ledge1.ai-ledger.workers.dev`).

  **Two traps make it look disconnected, and both fooled a previous session:**

  1. The builds API is keyed by **script tag**, not script name. Asking by name
     returns `12040: No build configuration` and an empty trigger list — a false
     negative indistinguishable from a true absence. Resolve the tag first:

     ```
     GET /accounts/{acct}/workers/services/ai-outcome-ledge1
         -> default_environment.script.tag
     GET /accounts/{acct}/builds/workers/{tag}          # config
     GET /accounts/{acct}/builds/workers/{tag}/triggers # triggers
     GET /accounts/{acct}/builds/workers/{tag}/builds   # history
     ```

  2. A finished build reads `status: "stopped"`. That means the container
     exited, **not** that it failed — read `build_outcome` (`success`) or the
     log tail instead. And a CI build runs `wrangler deploy` inside the
     container, so its deployment reads `Source: wrangler` exactly like a local
     one. Neither field distinguishes CI from CLI.

  `npm run deploy` from `web/` still works and is what the gate assumes. The
  collector (`worker/`) has no build config and deploys only by CLI.

- **The CI build env carries a trailing newline on `VITE_SUPABASE_ANON_KEY`**
  (stored `…fU4bg\n`, observed 2026-08-15). Local CLI builds read `.env` and are
  unaffected, so a CI-deployed bundle can carry a key a local build does not.
  Check this before trusting a push-deploy.

- **There are two frontend Workers and the wrong one still answers.**
  `ai-outcome-ledge1` is what `web/wrangler.jsonc` targets and is the real site.
  `ai-outcome-ledge` **does resolve** — this file previously said it did not,
  which was wrong (checked 2026-08-15). It returns HTTP 200 and serves the
  *unbuilt* dev `index.html`, whose `<script src="/src/main.tsx">` fails the
  module MIME check and leaves `#root` empty. So it is a blank white page on a
  name one character away from the live one, and a reader who lands there sees
  nothing and has no way to tell why. Delete it, or the next person debugs a
  site that was never deployed.

  The two are told apart by the trailing `1`, not by content:

  ```
  curl -s https://ai-outcome-ledge.ai-ledger.workers.dev/ | grep main.tsx
  ```

  A hit means you are on the dead one.

- **The outcomes job ran out of subrequests, and that is why it left no trace**
  (diagnosed and fixed 2026-08-15). It issued one query per company per series —
  four series against forty-five companies, about 180 sequential round trips in
  one invocation. A Worker invocation has a subrequest ceiling (50 on the free
  plan), and exceeding it does not raise something a job can catch: the isolate
  stops. The cruel part is why it was invisible — the catch block's "record the
  failure" PATCH is itself a subrequest, so it died too, and every outcomes row
  in `fetch_runs` had a null `finished_at`, `ok` null, an empty `errors` array
  and no notes. On the old health strip it read as "the outcomes job wrote no
  rows", which is true and points at entirely the wrong thing; two sessions went
  looking for a data problem that was not there.

  Every observed failure in `fetch_runs` fits the ceiling exactly: fundamentals
  costs about 26 requests and finished; prices costs about 21 and finished when
  it ran first but died when it followed fundamentals in the same invocation;
  outcomes wanted 180 and never finished from any starting point.

  Three things fix it, and all three matter:

  1. **One query per series for the whole table**, grouped by company in memory.
     Four reads instead of 180. `test/runOutcomes.test.ts` asserts the read count
     stays flat as companies are added — asserting only on rows written passes
     just as happily with the loop the wrong way round.
  2. **One job per cron trigger.** `CRON_JOBS` in `worker/src/index.ts` maps each
     trigger to exactly one job, so no two jobs share an invocation's budget.
     `test/budget.test.ts` reads `wrangler.jsonc` and fails if the two lists
     disagree.
  3. **`SubrequestBudget` in `worker/src/db.ts`** counts every outbound request
     and stops the job *before* the ceiling, holding back a reserve that only the
     `fetch_runs` writes may spend. A job that asks for too much now fails
     loudly with the number it reached, instead of vanishing.

  **Check it with `finished_at`, not with `rows_written`:**

  ```
  fetch_runs?select=job,started_at,finished_at,ok,rows_written,notes
    &job=eq.outcomes&order=started_at.desc&limit=3
  ```

  A null `finished_at` means it died again.

- **`Db.select` paginates with an explicit Range header, and the browser does
  too.** PostgREST answers an over-cap request with HTTP 200 and a truncated
  body — no error, no flag. `fetchAll` in `web/src/lib/supabase.ts` pages until a
  page comes back short and throws `TruncatedError` rather than returning a
  silently partial answer. Never add a `.limit()` and trust it.

- **React 19, and no chart library, and no charts.** Recharts pinned the app to
  React 18 and drew the margin series twice. The hand-rolled replacement is gone
  too: the margin window is typeset numbers, not a plot, so `d3-shape` and
  `d3-sankey` were removed with it.

- **Astryx was evaluated and rejected on measurement, not taste** (2026-08-15).
  It is real, MIT, and its type-scale methodology is what this project's ramp is
  modelled on. But it needs React 19 *and* StyleX, and one `Button` costs
  +131 kB of CSS and +136 kB of JS, because `astryx.css` is a static stylesheet
  for the whole system that cannot be tree-shaken. shadcn/ui was rejected for the
  same shape of reason. If this is revisited, re-measure rather than re-reason.

- **`motion` is a dependency, and it costs what Astryx was rejected for**
  (added 2026-08-15). The covers' headline reveal is React Bits' `BlurText`,
  their counting figures are React Bits' `CountUp`, and the directory's card
  entrance is `motion` directly. All of it is vendored into
  `web/src/vendor/reactbits/`, and all of it needs `motion`.
  Measured: the JS bundle went 503.75 kB → 640.51 kB (143.94 → 189.95 kB gzip).
  That is the same order as the +136 kB that got Astryx rejected above, for one
  animation. It was asked for explicitly; the alternative is the same reveal in
  CSS keyframes at no bundle cost. Re-measure before adding anything else.

  Every vendored component carries a header naming its local changes. Four
  matter, and all four were defects on screen rather than preferences:

  - `Waves` seeded its Perlin field with `Math.random()`, so no two loads drew
    the same picture.
  - `BlurText` set `will-change` permanently, pinning one compositor layer per
    word, which made the settled headline rasterise differently between loads.
  - `CountUp` paints whatever its spring last emitted, and a spring approaches
    its target rather than arriving: `$8.393B` sat on screen as `$8.37B` two
    seconds after it had stopped moving. It now writes the exact figure once
    the stated duration is up.
  - `CountUp` also repainted its *start* value whenever its formatter changed
    identity — which is every render of the parent — so clicking a stage on
    the blueprint reset every finished figure on the page to zero.

  The React Bits CLI cannot install any of them: `jsrepo add --registry
  https://reactbits.dev/ts/default` gets the site's HTML shell instead of a
  manifest. The published source is at `https://reactbits.dev/r/<Name>-TS-CSS`.

- **Stooq stopped serving automated clients (observed 2026-08-15).** Every symbol
  returns HTTP 200 with a JavaScript proof-of-work interstitial. The parser
  classifies it as `challenge`, `runPrices` stops at the first one and reports it
  once, and `npm run smoke` checks it on demand. **Price history is frozen until
  a price source is chosen; margins come from SEC XBRL and are unaffected.** Do
  not "fix" this by solving the challenge — it is the site declining automated
  access, and the answer is a different source.

- **Prices are off the schedule, not deleted** (`PRICES_ON_SCHEDULE` in
  `worker/src/index.ts`). The job is kept, tested and reachable at
  `/run?job=prices`. `price_delta_4q` is null on all 84 rows, so no price figure
  appears anywhere in the interface rather than a column of dashes.

- **Teleperformance, Klarna and CBA do not file usable us-gaap data.** No margin
  series is possible for them. This is expected, not a bug, and must not be
  reported as a warning. The collector tags these with `expected: true` on the
  `RunError`, `ok` ignores them, and the maintenance page lists them under
  "Standing, and not a fault".

- **`source_url` is null on all 84 rows.** The corpus records `source_name`,
  `source_type` and `source_date` but no URLs. The claim page states the source
  by name and date, says plainly that no URL is recorded, and offers the
  generated EDGAR / Scholar lookups labelled as lookups rather than as the
  source. Never fabricate one.

- **`RUN_TOKEN` was rotated on 2026-08-15** to trigger the collectors during the
  rebuild. The current value is in the final report of that session; rotate it
  again with `npx wrangler secret put RUN_TOKEN` from `worker/` if that is not
  acceptable.

---

## Design system — do not renegotiate

Cool ledger paper, not warm cream. The subject is audit.

```
--paper #edf0f3   --paper-raised #f7f9fa   --paper-sunk #e2e7ec
--ink #111a22     --ink-2 #46555f          --ink-3 #6b7a86
--rule #c9d2d9    --rule-strong #a5b3bd
--traced #146b52  --claimed #2c5c8c        --gap #a8391f
--transfer #8a6420 --quality #5b4a86
```

IBM Plex Sans Condensed (structure) / IBM Plex Serif (claims, so they read as
quoted disclosure) / IBM Plex Mono (every number, so columns align).

The type ramp is `--t-2xs` … `--t-4xl` in `styles.css`, anchored at 16px with a
ratio of 1.2, plus a 4px spacing scale (`--s-*`) and two motion tokens. Never
write a raw `px` font-size in a rule.

**Signature element:** the gap bar — solid green traced, diagonal-hatched red
untraced. It is the argument.

Zero border radius throughout. No gradients. No emoji. Scrollbars, focus rings
and the font-swap flash are handled once, globally, at the top of `styles.css`.

---

## Voice

Plain declarative sentences. Name things by what a reader controls, not by how
the system is built.

**Banned constructions:** "not simply X — it is actively Y", "oscillates
between", "delve", "leverage" as a verb, "seamless", "robust", "unlock",
"empower", abstract nominalizations, invented jargon. `test/interface.test.ts`
greps for them.

"Not traceable" must **always** carry the clarification that it does not mean the
claim is false. Several of these claims are audited and true.

**Never write prose that states a fact about the data.** Every sentence on the
ledger, every company verdict and every margin explanation is assembled from the
rows at render time — `lib/readout.ts`, `companies.verdict()`, `outcome.reason`.
A typed sentence about the numbers goes stale silently, and this is a project
about numbers being checkable.

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
