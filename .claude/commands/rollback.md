---
description: Get production back to the last known-good state, then diagnose
---

Production is broken. Restore first, understand second.

1. Use the Cloudflare tools to list recent deployments for this project and
   identify the most recent one that succeeded before the current bad one.

2. Tell me its ID and timestamp, and roll back to it.
   Cloudflare keeps every build, so this takes seconds and costs nothing.

3. Only once the site is serving again: read the failed build's log, find the
   actual cause, and tell me what it was in two sentences.

4. Do not fix forward on a broken production build. Fix on a branch, run the
   full gate, then ship.
