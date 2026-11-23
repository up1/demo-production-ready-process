---
name: api-definition-of-done
description: Pre-flight checklist an API developer agent must pass, with commands and evidence, before saying an endpoint or feature is done. Mirrors the production-readiness gate so the code passes /prod-ready. Use at the end of every API task.
---

# Definition of done for API work

Never write "done" or "complete" without the evidence below. Paste the actual command output (trimmed) in your final report.

## Start: threat and edge-case list (before coding)
Write 5-10 lines: who can call this, what could they send, what happens on retry, concurrently, with empty/huge/negative input, and when a dependency fails. Each line becomes a test.

## Gate (all must pass)
| # | Check | Command | Pass |
|---|---|---|---|
| 1 | Types | `npx tsc --noEmit` | 0 errors |
| 2 | Lint | `npx eslint .` | 0 errors (floating promises, any, complexity) |
| 3 | Tests | `npx vitest run --coverage` | all pass, coverage >= 70% on new modules |
| 4 | Dead code | `npx knip` | no new unused files/exports/deps |
| 5 | Duplication | `npx jscpd src --min-tokens 40` | no new clones |
| 6 | SAST | `semgrep scan --config p/javascript --config p/typescript --config p/owasp-top-ten --metrics=off --quiet src` | 0 findings |
| 7 | Secrets | `gitleaks detect --no-git --source . --redact --no-banner` | no leaks |
| 8 | Dependencies | `npm audit --omit=dev` | no High/Critical |
| 9 | Self-check grep | the grep in `secure-api-coding` | no unjustified hits |

If a tool is not installed or not configured, say so and add the setup. Do not skip silently.

## Rule coverage table (include in the final report)
For each rule of `secure-api-coding`, `robust-api-logic`, `maintainable-api-structure` that applies, name the test or file:line that satisfies it.
Example: `SQL parameters -> products.repository.ts:14; IDOR -> orders.test.ts "returns 404 for another user's order"`.

## Operational checklist (same as prod-readiness-gate)
health endpoint, graceful shutdown, structured logging, env config with no secret defaults, input validation on every write, rate limit on auth, tests present, lockfile + clean audit.

## Final report format
1. What changed (files)
2. Threat/edge-case list and which test covers each
3. Gate results (command, result)
4. Rule coverage table
5. Known gaps or risks, stated plainly (not hidden)
