---
description: Verify, commit, push, and confirm the Cloudflare deploy went green
---

Ship the current working-tree changes to production.

Run these in order and stop at the first failure. Do not skip a step because the
change "looks small" — the cross-view regressions are exactly the ones that look
small.

1. `git status --short` and `git diff --stat`. State in one line what is about to
   ship. If anything unexpected is staged, stop and ask.

2. Gate:
   - `cd web && npx tsc --noEmit && npm test && npx vite build`
   - `cd ../worker && npx tsc --noEmit && npm test`

   Expected: 189 web tests, 102 worker tests, silent typechecks, clean build.
   On failure: fix the code, not the test, and re-run the whole gate from the
   top.

3. Commit with a message naming the user-visible change, not the files touched.
   "Company page leads with the margin chart" — not "update CompanyView.tsx".

4. `git push`

5. Wait about 30 seconds, then use the Cloudflare tools to find the newest
   deployment for this project and report its status.
   - Success → give the live URL and remind me to hard-refresh.
   - Failure → pull the build log, name the actual cause, fix it, and run this
     whole command again from step 2. Do not ask permission to fix a build
     error; a red deploy is not a decision point.

6. If the change touched anything under `worker/`, also run
   `cd worker && npx wrangler deploy`. The Worker does not deploy on push.

Report at the end: what shipped, deploy status, and anything you noticed but did
not change.
