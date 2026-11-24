---
description: Full production-readiness check: security, bugs, debt in parallel, then a GO / NO-GO verdict
argument-hint: [path, default demo-app]
---

Run a production-readiness review of `$ARGUMENTS` (default: `demo-app/`).

0. Run deterministically first and keep the output for the reports: `bash scripts/check-structure.sh` and `cd demo-app && npm run verify`. Pass the results to `release-gatekeeper`; do not re-derive them.
1. In ONE message, launch these three agents in parallel: `security-auditor`, `bug-hunter`, `debt-analyst`. Each writes its report under `reports/`.
2. When all three are done, launch `release-gatekeeper` to write `reports/prod-ready.md` and issue the verdict.
3. Show me: the verdict on the first line, the blocking findings by ID, counts per category, and how many findings only the agents found (not scanners).

Do not fix anything.
