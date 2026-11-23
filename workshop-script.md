# Workshop script: "Is AI-written code production ready?"

60 minutes, 100% live demo, English. Tool: Claude Code only.
Open with the repo at a clean state: `./scripts/reset-demo.sh`, then `claude` in the repo root.

**Fallback rule:** if a command runs longer than 90 seconds, say "I recorded this earlier" and open the matching file in `demo/recorded/`.

## 0:00-0:05 Intro
- Slide 1-4. The prompt that built the app (slide 3). It works, it demos fine, it is under 300 lines.
- Message: AI code looks right. We need evidence, not opinions.
- Agent = who does the work (own context, limited tools). Skill = what it knows. Command = the button you press.

## 0:05-0:15 Vulnerabilities: `/scan-vuln`
1. Run `./scripts/run-all-scanners.sh` first (6 seconds). Show: gitleaks clean, npm audit clean, semgrep found 1 thing (HTTP fetch).
   "Green scanners. Ship it?"
2. Run `/scan-vuln`. While it runs, show `.claude/agents/security-auditor.md` and the `owasp-review` skill.
3. Expected AI-found items: SQL injection in `GET /products?search=` (src/routes.ts), fallback JWT secret `'secret'` (src/auth.ts), IDOR on `GET /orders/:id`, any user can create/edit products (no role check), `Math.random()` reset token + token logged, no rate limit on login, no validation.
4. Live proof: `curl "localhost:3000/products?search=' UNION SELECT id,email,password,0 FROM users--"` (start app with `npm start` in a second terminal).
5. Point out the Source column: scanner vs AI-found. Show an "Unverified" item.

## 0:15-0:25 Hidden bugs: `/find-bugs`
1. Say: "tsc strict passes. The app runs."
2. Run `/find-bugs`. Show the failing tests it wrote in `demo-app/tests/bugs/`.
3. Expected confirmed bugs: same product twice in one order bypasses stock check (stock goes negative), negative quantity increases stock and gives negative total, float money (`0.1 + 0.2`), `forEach(async)` alert fire-and-forget with swallowed error, daily report uses UTC date vs local date, unbounded `limit`, order creation is not in a transaction.
4. Show one failing test and its message (observed vs expected).

## 0:25-0:35 Technical debt: `/find-debt`
1. Run `/find-debt`. Show the rubric score table.
2. Expected: no tests (0% coverage), SQL inside route handlers (no layers), `any` count, magic numbers in pricing, one unused export, no logging or config layer.
3. Honest note: duplication is low here (jscpd 0%). Not everything is bad. Debt is mostly structure and missing tests.

## 0:35-0:43 Everything together: `/prod-ready`
1. Run `/prod-ready`. Show three agents running in parallel, then the gatekeeper.
2. Verdict expected: **NO-GO**. Read the blockers by ID.
3. Show the OPS checklist: /health exists (pass), graceful shutdown (fail), structured logging (fail), env config (fail: default secret), validation (fail), rate limit (fail), tests (fail), lockfile + audit (pass).

## 0:43-0:53 Fix and re-run
1. Ask Claude Code to fix SQLi (parameterized query) and remove the JWT secret fallback (fail fast if unset).
2. Re-run `/scan-vuln`; findings drop. Re-run `/prod-ready` only if time allows; otherwise show `demo/recorded/prod-ready-after-fix.md`.
3. Scanner-only vs scanner + AI: show `reports/scanner-only/` side by side with the AI report. Scanners found 1; agents found the rest.

## 0:53-1:00 Recap + Q&A
- Evidence beats opinion: no evidence = Unverified.
- Scanners are the floor, not the ceiling.
- Agents isolate context, skills hold the checklist, commands make it repeatable in CI or a team.
- Same concepts exist in other tools (instructions files, rules, workflows).

## Before the talk checklist
- `./scripts/setup.sh` shows READY
- Port 3000 free; `cd demo-app && npm run build && npm start` works
- `demo/recorded/` has the latest outputs (record them once with a dry run)
- Terminal font large, notifications off
