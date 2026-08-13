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
| Frontend | `web/` — Vite + React 18 + TypeScript | Deployed to Cloudflare on push to `main` |
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

Expected: **131** web tests, **33** worker tests, both typechecks silent, build
clean.

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

- The collector's outcomes job was writing zero rows because `Db.select` issued
  unbounded requests and PostgREST silently truncates over-cap responses with
  HTTP 200. Fixed with explicit `Range` pagination. If margins are still blank,
  read `fetch_runs.notes` — the job now reports which branch it took and how
  often.
- Teleperformance, Klarna and CBA do not file with the SEC. No margin series is
  possible for them. This is expected, not a bug, and must not be reported as a
  warning.

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
