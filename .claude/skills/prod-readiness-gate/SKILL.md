---
name: prod-readiness-gate
description: Defines the finding format, evidence rules, operational checklist and GO / GO-with-conditions / NO-GO criteria for deciding whether code is production ready. Use when writing audit reports or issuing a release verdict.
---

# Production readiness gate

## Evidence rule (most important)
A finding is real only with evidence: scanner output, a failing test, or file:line plus a reproduced request. Otherwise put it under **Unverified** and do not let it affect the verdict.

## Finding format
| ID | Severity | Location | Evidence | Source | Why AI wrote it | Fix |
|---|---|---|---|---|---|---|
| SEC-1 | Critical | src/x.ts:42 | semgrep rule id / output | scanner or AI-found | short reason | one-line fix |

IDs: `SEC-n`, `BUG-n`, `DEBT-n`, `OPS-n`. Severity: Critical, High, Medium, Low.

## Operational checklist (OPS, 8 items; pass/fail with evidence)
1. Health endpoint (`/health`) exists
2. Graceful shutdown (SIGTERM closes server and DB)
3. Structured logging (not bare `console.log` of objects/secrets)
4. Config from environment, no secrets in code
5. Input validation on all write endpoints
6. Rate limiting on auth routes
7. Tests exist and core logic coverage >= 70%
8. Lockfile committed and `npm audit --omit=dev` has no High/Critical

## Verdict
- **NO-GO** if any: Critical or High vulnerability; hard-coded secret; Confirmed bug that corrupts or loses data (money, stock, orders); build or tests fail; no tests on money/auth logic.
- **GO WITH CONDITIONS** if only Medium/Low remain AND each has an owner and a deadline written in the report.
- **GO** if all gates pass.

## Report layout (`reports/prod-ready.md`)
1. Verdict banner (GO / GO WITH CONDITIONS / NO-GO) and the blocking findings
2. Summary counts by category and severity
3. Findings tables per category (confirmed only)
4. OPS checklist table
5. Unverified section
6. "Scanner only vs scanner + AI" note: which findings only AI found
