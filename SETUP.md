# Setup — from absolutely nothing

This assumes you have never opened a terminal, never used Supabase, Cloudflare, or Git, and have nothing installed. Every step says exactly what to type and exactly what you should see when it worked.

**Time:** about an hour the first time. **Cost:** $0. Everything fits inside free tiers and no step asks for a card.

**You will create:** a Supabase account (the database), a Cloudflare account (the server and the website), and optionally GitHub.

---

## How to read this

- Text in `grey boxes` is something you type into the terminal, then press Enter.
- After each command I say what you should see. If you see it, move on. If you don't, check Troubleshooting at the bottom before continuing — carrying a broken step forward wastes more time than stopping.
- Nothing here can damage your computer. The worst outcome is an error message.

---

# Part 0 — Get the tools

## 0.1 Open a terminal

The terminal is a window where you type commands instead of clicking. You'll use it about fifteen times total.

**Mac:** press `Cmd` + `Space`, type `Terminal`, press Enter.

**Windows:** click Start, type `PowerShell`, click **Windows PowerShell**.

Leave this window open for the rest of the setup.

## 0.2 Install Node.js

Node.js runs the project's code. Nothing works without it.

First check whether you already have it:

```
node --version
```

- Prints `v20` or higher (like `v20.11.0` or `v22.3.0`) → skip to 0.3.
- Says "command not found" or "not recognized" → carry on.

Go to **<https://nodejs.org>**. Click the big green **LTS** button. Open the downloaded file and click through the installer accepting every default.

**Then close your terminal window completely and open a new one.** The installer only affects terminals opened after it finishes — this catches almost everyone. Now:

```
node --version
```

You should see a version number. If not, restart your computer and try once more.

## 0.3 Check for Git

Only needed for the optional auto-deploy path. Check now so you know which route to take:

```
git --version
```

- Prints `git version 2.x` → good.
- Not found → fine. Use **Path A** in Part 3, which doesn't need Git.

## 0.4 Unzip the project and navigate to it

Find `ai-outcome-ledger.zip` in Downloads. Double-click it (Mac expands automatically; Windows: right-click → **Extract All** → **Extract**).

You now have a folder called `ai-outcome-ledger`. Tell the terminal to go there.

**Easy way, Mac:** type `cd ` — c, d, space — then drag the `ai-outcome-ledger` folder from Finder onto the terminal window. It fills in the path. Press Enter.

**Easy way, Windows:** in File Explorer, open the `ai-outcome-ledger` folder, click the address bar at the top, type `powershell`, press Enter. A terminal opens already in that folder.

**Manual way**, if it's in Downloads:

```
cd ~/Downloads/ai-outcome-ledger
```

Confirm you're in the right place:

```
ls
```

*Windows PowerShell: use `dir` instead of `ls` for this one command.*

**You should see:** `README.md`, `SETUP.md`, `docs`, `supabase`, `web`, `worker`.

If you see anything else, you're in the wrong folder. Don't continue until this matches.

---

# Part 1 — Supabase: the database

Supabase is a hosted Postgres database with a ready-made API in front of it. The database holds the 84 coded claims; the API is what the website reads.

## 1.1 Create the account and project

1. Go to **<https://supabase.com>**, click **Start your project**.
2. Sign in with GitHub, or with email. If email, click the confirmation link before continuing.
3. If asked to create an organisation, name it anything (your own name is fine) and pick the **Free** plan.
4. Click **New project**:
   - **Name:** `ai-outcome-ledger`
   - **Database Password:** click **Generate a password**, then **copy it somewhere safe**. You'll probably never need it, but it cannot be recovered.
   - **Region:** whichever is closest to you.
5. Click **Create new project**.

**Wait two to three minutes** while it provisions.

> **Open a blank note now**, titled "AI Ledger keys". You'll collect five values across this guide and need them in different places. Hunting for them later is the main thing that makes this feel harder than it is.

## 1.2 Load the database — four files, in order

The most important part of the setup. **Order matters:** file 3 needs tables built by file 1, file 4 needs rows created by file 3.

1. In the Supabase left sidebar, click **SQL Editor** (a database icon with `>_`).
2. Click **New query**.
3. On your computer open `ai-outcome-ledger` → `supabase`. Open **`01_schema.sql`** by right-clicking → **Open With** → TextEdit (Mac) or Notepad (Windows).
4. Click inside the text, select all (`Cmd`+`A` / `Ctrl`+`A`), copy (`Cmd`+`C` / `Ctrl`+`C`).
5. Click into the big empty box in the Supabase SQL Editor and paste (`Cmd`+`V` / `Ctrl`+`V`).
6. Click the green **Run** button, bottom right.

**You should see:** `Success. No rows returned`.

Now the same for the other three, **in this order**. Each time: **New query**, open file, select all, copy, paste, Run.

| Order | File | Success looks like |
|---|---|---|
| 1 | `01_schema.sql` | Success. No rows returned |
| 2 | `02_policies.sql` | Success. No rows returned |
| 3 | `03_seed_companies.sql` | Success. No rows returned |
| 4 | `04_seed_claims.sql` | A table showing `claims_loaded` and the number **84** |

**If file 4 shows 84, your database is correct.**

> **If you get a red error:** almost always a file pasted out of order, or a partial paste. All four files are safe to re-run from the beginning — they clean up after themselves. Start again at file 1 and go in order. You cannot damage anything by re-running them.

## 1.3 Prove the data is really there

**New query**, paste, Run:

```sql
select claim_kind, count(*) from v_ledger group by 1 order by 2 desc;
```

**You should see five rows:** `gain_claim` 32, `counter_evidence` 16, `context` 15, `research_finding` 15, `pricing` 6.

## 1.4 Collect your three keys

Left sidebar → **gear icon** (Project Settings) → **API**.

Copy these into your notes:

| Called on the page | Looks like | Goes into |
|---|---|---|
| **Project URL** | `https://abcdefgh.supabase.co` | Worker *and* website |
| **anon** `public` | long string starting `eyJ` | Website only |
| **service_role** `secret` | a *different* long string starting `eyJ` | Worker only |

You may need to click **Reveal** or an eye icon to see service_role.

> **The service_role key bypasses every security rule in the database.** It belongs only in the Worker, which runs on Cloudflare's servers. Never put it in the website, never paste it into a chat or email, never commit it to GitHub. If it leaks, return to this page and click **Reset** — the old one dies instantly.
>
> The **anon** key is different and is *designed* to be public. The rules you loaded in file 2 are what make it safe: it can read published rows and add a submission, nothing else.

---

# Part 2 — Cloudflare Worker: the collector

The piece that runs on a timer, pulls financial data from the SEC and share prices from Stooq, and writes them into your database. It's what makes this a living record rather than a snapshot.

## 2.1 Create a Cloudflare account

Go to **<https://dash.cloudflare.com/sign-up>**, sign up, verify your email. You do **not** need a domain and do **not** need a card. If it pushes you to add a website, look for a skip option — you can always reach the dashboard at <https://dash.cloudflare.com>.

## 2.2 Install the Worker's code

In your terminal, still in the `ai-outcome-ledger` folder:

```
cd worker
```

```
npm install
```

Takes 30–60 seconds and prints a lot of text. **You should see** a final line like `added 120 packages`. Yellow warnings are normal; red `ERR!` is not.

## 2.3 Connect your terminal to Cloudflare

```
npx wrangler login
```

If it asks `Ok to proceed? (y)`, type `y` and press Enter. Your browser opens — click **Allow**.

**You should see** `Successfully logged in`.

## 2.4 Set the four secrets

Values the Worker needs that must never be written into a file. Four commands; each asks you to paste something.

**Nothing appears on screen while you paste. That's deliberate — it's hidden.** Paste, press Enter, move on.

```
npx wrangler secret put SUPABASE_URL
```
Paste your **Project URL** — `https://abcdefgh.supabase.co`, **no slash on the end**.

```
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```
Paste the **service_role** key (the secret one).

```
npx wrangler secret put SEC_USER_AGENT
```
Type your name and email, like `Jane Smith jane@example.com`. Not decoration — the SEC requires a real contact string and blocks you without one.

```
npx wrangler secret put RUN_TOKEN
```
A password you invent, protecting the manual "run now" address so a stranger can't hammer your collector. Generate one:

```
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

**Copy what it prints into your notes**, then run the `RUN_TOKEN` command above and paste it. You need it again in 2.6.

Each command ends with `Success! Uploaded secret`.

## 2.5 Send the Worker to Cloudflare

```
npx wrangler deploy
```

**You should see** a URL like `https://ai-outcome-ledger.your-name.workers.dev`. **Copy it into your notes.**

Check it's alive — open that URL in your browser with `/health` on the end:

```
https://ai-outcome-ledger.your-name.workers.dev/health
```

**You should see** a small block of text containing `"ok": true`.

## 2.6 Run the collector once, by hand

It runs on a schedule, but you don't want to wait until tomorrow. Open this in your browser, substituting your URL and your token:

```
https://ai-outcome-ledger.your-name.workers.dev/run?job=all&token=YOUR_RUN_TOKEN
```

**Takes two to four minutes.** The SEC limits requests to 10 per second and the Worker deliberately respects that. Leave the tab open; a blank white page while it works is normal. It finishes by printing a summary.

**Confirm it landed.** Supabase SQL Editor, new query:

```sql
select series_key, count(*), max(observed_at) from observations group by 1;
```

**You should see** several thousand rows across `revenue_q`, `operating_income_q`, `operating_margin_q`, `price_close`.

If empty, the Worker records every run — this tells you the actual error:

```sql
select job, status, started_at, error from fetch_runs order by started_at desc limit 5;
```

From here it maintains itself: fundamentals 22:30 UTC weekdays, prices 06:15 UTC daily.

---

# Part 3 — The website

## 3.1 Run it on your own machine first

If the deploy later fails, you'll already know the app itself is fine.

```
cd ../web
```

```
npm install
```

Create your settings file.

**Mac:**
```
cp .env.example .env.local
```

**Windows PowerShell:**
```
copy .env.example .env.local
```

Open the new `.env.local` in TextEdit or Notepad — it's inside the `web` folder. *(Mac hides dot-files in Finder: press `Cmd`+`Shift`+`.` to show them.)*

Replace the placeholders with your own values:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...your anon key...
```

**Use the anon key, not service_role.** Save and close.

```
npm run dev
```

**You should see** `Local: http://localhost:5173/`. Open that in your browser.

**You should see** the Reconciliation view — a column of green-and-red-hatched bars, with `$8.39B claimed` and `$0.45B tied to a disclosed line` across the top.

Click around: Ledger, open a row, Transfers, Conditions. If this works, everything upstream is correct.

When done, click the terminal and press `Ctrl`+`C` to stop it.

---

## Now pick one of two paths

**Path A — Direct upload.** No GitHub, no Git, five minutes. One command rebuilds and re-uploads. **If unsure, take this one.**

**Path B — GitHub.** More setup now, but the site rebuilds itself every time you push. Worth it if you'll edit regularly.

---

## Path A — Deploy directly (recommended)

You're in the `web` folder with everything installed. One command:

```
npm run deploy
```

The first time it asks:

- **Create a new project?** → Yes
- **Project name** → press Enter to accept `ai-outcome-ledger`
- **Production branch** → press Enter for the default

**You should see** a URL like `https://ai-outcome-ledger.pages.dev`. Open it — identical to what you saw on localhost.

**That's it. You're live.**

Whenever you change a claim or the code, run `npm run deploy` again from the `web` folder.

> Your Supabase URL and anon key get baked into the site when it builds, which is why `.env.local` must be correct *before* deploying. If you ever change them, edit `.env.local` and run `npm run deploy` again.

Skip to **Part 4**.

---

## Path B — Deploy via GitHub (auto-rebuild)

Needs Git from step 0.3. If you don't have it, install from <https://git-scm.com/downloads> accepting all defaults, then restart your terminal.

### B.1 Make the repository

1. Go to <https://github.com/new> (sign up first if needed).
2. **Repository name:** `ai-outcome-ledger`
3. **Private** unless you want it public.
4. Do **not** tick "Add a README file".
5. **Create repository.** Leave the page open.

### B.2 Push the code

Back to the top-level folder:

```
cd ..
```

Then, one at a time:

```
git init
```
```
git add .
```
```
git commit -m "AI Outcome Ledger"
```

If Git says it doesn't know who you are, run these with your own details then repeat the commit:

```
git config --global user.email "you@example.com"
```
```
git config --global user.name "Your Name"
```

Then:

```
git branch -M main
```
```
git remote add origin https://github.com/YOUR_USERNAME/ai-outcome-ledger.git
```

Replace `YOUR_USERNAME` with your actual username.

```
git push -u origin main
```

It'll ask you to sign in to GitHub; a browser window usually handles it.

**Now verify no secrets went up.** Refresh your repo page on GitHub, click into `web`. **There must be no `.env.local` listed.** The `.gitignore` files exclude it, but check with your own eyes — this is the one mistake in this guide with real consequences.

### B.3 Connect Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** in the sidebar.
2. **Create** → **Pages** tab → **Connect to Git**.
3. Authorise GitHub, pick `ai-outcome-ledger`, click **Begin setup**.
4. Fill in **exactly**:

| Field | Value |
|---|---|
| Project name | `ai-outcome-ledger` |
| Production branch | `main` |
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| **Root directory** (under *Advanced*) | `web` |

**Root directory is the field everyone misses.** The website lives in a subfolder. Without it, Cloudflare looks at the top level, finds no `package.json`, and builds nothing.

5. Expand **Environment variables**, add two:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Project URL |
| `VITE_SUPABASE_ANON_KEY` | your **anon** key |

Required here even though you set them locally — `.env.local` was never uploaded, by design.

6. **Save and Deploy.** Two minutes later you get a URL like `https://ai-outcome-ledger.pages.dev`.

Every `git push` now rebuilds the site automatically.

---

# Part 4 — Confirm it all works

On your live site, check four things:

1. **Reconciliation shows bars** — green portion tied to a disclosed line, hatched portion not.
2. **The health strip at the top is green**, showing a recent collector run. Amber = more than two days since a clean run. Red = last run failed.
3. **Open a row in the Ledger.** Public companies (IBM, Salesforce, Verizon) show a margin chart with a dashed red line at the claim date. Private ones (Cursor, Lovable) show an em dash — expected, they don't file with the SEC.
4. **Conditions shows numbers in the cells** — the 2×2×2 populated with real margin movement from filings.

All four hold → you're fully running.

---

# Troubleshooting

**"command not found: node" / "not recognized"**
Node isn't installed, or you didn't open a fresh terminal afterwards. Close it completely, open a new one. If it persists, restart your computer.

**"no such file or directory" when I `cd`**
You're not where you think. Type `ls` (Mac) or `dir` (Windows) to see what's around you. Use the drag-the-folder trick from 0.4.

**Site says "relation v_ledger does not exist"**
The SQL files weren't all run, or not in order. Back to 1.2, run all four from the top.

**Site loads but shows zero rows**
File 4 didn't run. In the SQL editor: `select count(*) from claims;` — should say 84.

**Every margin column is an em dash**
The collector hasn't run or failed. `select * from fetch_runs order by started_at desc limit 5;` — the `error` column tells you what happened.

**The SEC returns 403**
`SEC_USER_AGENT` doesn't contain a valid email. From the `worker` folder: `npx wrangler secret put SEC_USER_AGENT`, then `npx wrangler deploy`.

**Path B: build fails, "no package.json found"**
Root directory isn't `web`. Cloudflare → your project → Settings → Builds & deployments → edit configuration.

**Path B: build succeeds but the page is blank**
Environment variables missing or misspelled. Must be exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. After fixing, trigger a new build: Deployments → latest → **Retry deployment**.

**I accidentally committed my service_role key**
Supabase → Project Settings → API → **Reset** the service_role key. Then update the Worker: `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`, `npx wrangler deploy`. The old key is useless immediately.

**A specific company shows no data**
Expected for about a third of entities. Private companies, foreign filers, and research populations have no quarterly SEC filings to pull. The row keeps its coding and shows an em dash rather than a guess.

---

# What to do next

- **Work the verification queue.** 17 rows need a primary source; each carries the exact next step and a one-click link to the right EDGAR or Scholar search.
- **Add claims.** `docs/DATA_DICTIONARY.md` has a template and the four rules that matter, in the order they usually go wrong.
- **Read `docs/METHODOLOGY.md` first.** The coding rules are what make this worth having; applied loosely it becomes a list of press releases.
