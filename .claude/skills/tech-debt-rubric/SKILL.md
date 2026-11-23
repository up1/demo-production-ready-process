---
name: tech-debt-rubric
description: Scoring rubric and detection commands for technical debt in AI-generated TypeScript code (duplication, complexity, any-types, dead code, layering, missing tests). Use when assessing maintainability.
---

# Technical debt rubric

AI tends to generate code that works now and costs later: copy-paste instead of reuse, giant functions, `any`, no layers, no tests.

## Dimensions (score each 0 = bad, 3 = good)

| Dimension | Detect with | 3 (good) | 0 (bad) |
|---|---|---|---|
| Duplication | `npx jscpd src --min-tokens 40` | <3% duplicated | >10% |
| Function size / complexity | eslint `complexity` (max 10), `max-lines-per-function` (max 50) | none over limits | several >100 lines or complexity >20 |
| Type safety | grep `: any`, `as any`; `tsc --strict` error count | no `any`, strict clean | `any` widespread, strict fails |
| Dead code | `npx knip` (unused files, exports, deps) | none | many |
| Layering | read imports: do routes import the DB directly? | route -> service -> repository | SQL inside route handlers |
| Tests | `npx vitest run --coverage` | >=70% lines on core logic | no tests |
| Magic values / config | grep numeric literals (`0.07`, `3600`), hard-coded URLs | constants/env | scattered literals |
| Dependencies | `npm outdated`, unused deps from knip | current, minimal | many outdated/unused |

## Output
- Score table (dimension, score, evidence, interest: what it costs when left).
- Top 5 debt items ranked by (effort to fix) vs (cost of leaving), each with file:line and the tool output that proves it.
- Debt total: sum / max, with band: 20-24 healthy, 12-19 manageable, <12 blocks scaling the team.
- Debt never causes NO-GO alone, except missing tests on money/auth logic, which the gatekeeper treats as a gate failure.
