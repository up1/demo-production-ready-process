# Better AI-written APIs: prevent the mistakes, not just find them

The audit agents (`/scan-vuln`, `/find-bugs`, `/find-debt`, `/prod-ready`) find problems **after** the code is written.
The `api-developer` agent and its skills tell the AI how to write the code **correctly the first time**.

> Status: written and reviewed, **not yet run end to end**. Do a dry run and save the outputs to `demo/recorded/` before presenting.

## The idea in one picture

```
Prompt ──► api-developer (+ 4 skills) ──► code + tests + gate evidence
                                              │
                                              ▼
                              /prod-ready  (the same auditors as before)
                                              │
                                  GO / GO WITH CONDITIONS / NO-GO
```

Same prompt, two ways of writing it, one judge.

## What was added

### Agent: `api-developer`
File: `.claude/agents/api-developer.md`

A careful senior API developer. Assumes its first draft contains the usual AI mistakes unless it proves otherwise.

Process:
1. **Understand**: read existing code, note existing debt, do not copy bad patterns.
2. **Threat and edge-case list** before any code (who calls it, bad input, retry, concurrency, dependency failure).
3. **Tests first**: write failing tests for that list, confirm they fail for the right reason.
4. **Implement in layers**: routes, service, repository. zod validation at the boundary. Integer money. Transactions.
5. **Run the full gate** (tsc, eslint, vitest, knip, jscpd, semgrep, gitleaks, npm audit) and fix what it reports.
6. **Self-review** as an attacker and as QA. Run the self-check grep.
7. **Report with evidence**: command output, not claims.

Hard rules: no string-built SQL, no default secrets, no skipped authorization, no `Math.random()` tokens, no float money, no `forEach(async)`, no empty `catch`, no `any`. If the user asks for something unsafe ("skip auth for now"), it explains the risk and asks first. It never says "done" or "production ready" without gate evidence.

### Skills

| Skill | Prevents | Key rules |
|---|---|---|
| `secure-api-coding` | Vulnerability | Parameterized SQL (wildcards in the parameter). No default for secrets, fail at startup. Ownership in every query (`AND user_id = ?`, return 404). `requireRole` on admin routes. `crypto.randomBytes` tokens, hashed, expiring. JWT with short expiry and pinned algorithm. zod `.strict()` validation, no mass assignment. Rate limit, helmet, CORS allowlist. Central error handler, HTTPS and timeouts for outbound calls. |
| `robust-api-logic` | Hidden bug | Money as integer cents. Atomic `UPDATE ... WHERE stock >= ?` inside a transaction. Merge duplicate order lines before checking stock. Reject negative or huge quantities. No `forEach(async)`, no floating promises, no swallowed errors. UTC storage and explicit timezone for reports. Clamped pagination. Graceful shutdown. |
| `maintainable-api-structure` | Technical debt | Layered folders (routes, service, repository, pure domain functions). `config.ts` is the only reader of `process.env`. pino logger, no `console.log`. No `any`. Named constants, tier data not `if/else` ladders. Function at most 50 lines, complexity at most 10. Tests ship with the code, coverage at least 70%. `npm run verify` script. |
| `api-definition-of-done` | All three | The 9-check gate with commands, a rule-to-test coverage table, the operational checklist, and the final report format. Mirrors `prod-readiness-gate`, so passing it is what makes `/prod-ready` pass. |

### How the two halves connect

| Audit side (find) | Prevention side (avoid) |
|---|---|
| `owasp-review` | `secure-api-coding` |
| `bug-pattern-catalog` | `robust-api-logic` |
| `tech-debt-rubric` | `maintainable-api-structure` |
| `prod-readiness-gate` | `api-definition-of-done` |

Every rule on the right exists because of a finding on the left. Say this on the slide: *the review checklist becomes the writing checklist*.

## Step by step: before vs after demo (about 10 minutes)

### 0. Preparation (once, before the talk)
```bash
./scripts/setup.sh                 # must end with READY
git add -A && git commit -m "workshop baseline"   # reset-demo.sh depends on a commit
```
Port 3000 free. Terminal font large.

### 1. BEFORE: the plain version (already in the repo)
`demo-app/` is the app a plain session produced. Show the result of the audit you already ran:
```
/prod-ready demo-app
```
Expected: **NO-GO**. Copy the report so the next run does not overwrite it:
```bash
cp reports/prod-ready.md reports/prod-ready-before.md
```

### 2. AFTER: same prompt, with `api-developer`
Start a **new** Claude Code session in the repo root (clean context), then:

```
Use the api-developer agent to build a new project in demo-app-better/ (Node.js, Express,
TypeScript, SQLite with better-sqlite3): an order management API with users, login (JWT),
products with stock, creating orders that reduce stock, listing orders with pagination, and
order total calculation with discount and tax.
```

This is the same requirement as the original prompt, so the comparison is fair. Do not mention security or bugs in the prompt. The agent and its skills must add that on their own.

Show while it works (about 5 to 8 minutes, narrate, do not wait in silence):
- It lists threats and edge cases first.
- It writes failing tests, then code.
- It runs tsc, eslint, vitest, semgrep, gitleaks, audit.
- It ends with a report: gate results and a rule-to-test table.

> If the run is longer than 90 seconds past the point where you want to move on, open the saved output in `demo/recorded/api-developer-run.md` and the finished `demo-app-better/`.

### 3. JUDGE: same auditors on the new code
```
/prod-ready demo-app-better
```
```bash
cp reports/prod-ready.md reports/prod-ready-after.md
```
Expected: verdict better than NO-GO. Be honest if it is not: whatever the auditors still find is the interesting part of the talk (see "If it is not perfect" below).

### 4. Compare on one slide
| | demo-app (plain) | demo-app-better (api-developer) |
|---|---|---|
| Verdict | NO-GO | _fill in from the run_ |
| Critical/High vulnerabilities | _n_ | _n_ |
| Confirmed bugs | _n_ | _n_ |
| Debt score | _x / 24_ | _x / 24_ |
| Tests / coverage | none | _n tests, x%_ |

Fill the table from `reports/prod-ready-before.md` and `reports/prod-ready-after.md`. Do not present numbers you did not measure.

## If it is not perfect (and it may not be)

- The auditors may still find issues in `demo-app-better`. That is a result, not a failure: it shows the skills reduce mistakes, and the audit stays necessary as a second line of defence.
- If the agent skips a rule, check whether the skill is too long or ambiguous and shorten it. Skills only help if the agent actually follows them.
- `/prod-ready` writes to `reports/`; always copy the report before the next run.

## Known gaps to fix before presenting
1. **Untested end to end.** Run steps 2 and 3 once and save the outputs.
2. **Scanner setup for a new project.** `demo-app-better` needs its own eslint, knip and vitest config. `api-developer` is told to run the gate, but may need to create these. If it struggles, copy `demo-app/eslint.config.mjs` and `demo-app/knip.json` first.
3. **Stricter than the auditors.** Some prevention rules (for example bcrypt cost 12, 12-character passwords, 15-minute JWT) are stricter than what `security-auditor` checks. Code that follows the rules will pass, but code that breaks only those rules will not be flagged.
4. **Skills are loaded by the agent, not automatically.** In a plain session without the agent, the skills may not load. A short `CLAUDE.md` pointing to them would make every session follow the rules. Not added, because the audit agents would read it too.

## Take-away line
> Auditing finds mistakes after they exist. Skills and agents move the same knowledge to the moment the code is written. Use both: write with `api-developer`, verify with `/prod-ready`.
