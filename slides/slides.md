---
marp: true
theme: default
paginate: true
---

# Is AI-written code production ready?

Catching vulnerabilities, hidden bugs and technical debt with agents, skills and commands

<!-- Speaker: 60 min, all live demo. Fallback: demo/recorded/ if a run exceeds 90s. -->

---

# The code looks right

- It compiles. The happy path works. The demo is green.
- Under 300 lines, written in minutes.
- So what could be wrong?

<!-- Intro 0:00-0:05 -->

---

# The prompt

> "Build an order management API with users, login (JWT), products with stock, creating orders that reduce stock, listing orders with pagination, and order total calculation with discount and tax."

Node.js, Express, TypeScript, SQLite. Follow-up prompts added search, password reset, low-stock alerts and a daily report.

<!-- Be upfront: the base app came from this prompt. The search, reset, alert and report features were added by hand in AI style to cover more categories. -->

---

# Today's rule

**No evidence = Unverified.**

An AI reviewing AI code must show proof:
a scanner hit, a failing test, or a reproduced request.

---

# Agent, Skill, Command

| | Is | Analogy |
|---|---|---|
| Agent | A worker with its own context and limited tools | **Who** |
| Skill | Knowledge loaded when needed | **Knows what** |
| Command | A saved prompt you run with `/name` | **The button** |

---

# What we built

| Agents | Skills | Commands |
|---|---|---|
| security-auditor | owasp-review | /scan-vuln |
| bug-hunter | bug-pattern-catalog | /find-bugs |
| debt-analyst | tech-debt-rubric | /find-debt |
| release-gatekeeper | prod-readiness-gate | /prod-ready |

---

# Demo 1: Vulnerabilities

`/scan-vuln`

First, the scanners alone: gitleaks clean, npm audit clean, semgrep 1 hit.

Then the agent. What did it find that scanners missed?

<!-- 0:05-0:15. Show SQLi live with curl. Source column: scanner vs AI-found. -->

---

# Demo 2: Hidden bugs

`/find-bugs`

Compiles. Passes `tsc --strict`. Still wrong.

Every bug comes with a **failing test**.

<!-- 0:15-0:25 -->

---

# Demo 3: Technical debt

`/find-debt`

Scored with a rubric, backed by tool output.

Not everything is bad: duplication was 0%. Debt here is structure and missing tests.

<!-- 0:25-0:35 -->

---

# Demo 4: Is it production ready?

`/prod-ready`

Three agents in parallel, then the gatekeeper decides.

**NO-GO** if: Critical/High vulnerability, hard-coded secret, data-corrupting bug, failing build/tests, no tests on money/auth.

<!-- 0:35-0:43 -->

---

# Fix and re-run

Fix SQL injection and the JWT secret fallback. Re-run. The verdict changes.

Scanner only vs scanner + agents: who found what?

<!-- 0:43-0:53 -->

---

# Takeaways

1. Evidence beats opinion
2. Scanners are the floor, not the ceiling
3. Agents isolate context, skills hold the checklist, commands make it repeatable
4. Same ideas work in other AI tools

Q&A

<!-- 0:53-1:00. Repo: .claude/agents, .claude/skills, .claude/commands -->
