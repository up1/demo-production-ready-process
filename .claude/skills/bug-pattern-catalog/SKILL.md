---
name: bug-pattern-catalog
description: Catalog of hidden bugs that AI-generated TypeScript/Node code commonly contains, with detection method and a failing-test recipe for each. Use when hunting logic and runtime bugs that compile and look fine.
---

# Hidden bug catalog

A hidden bug is code that compiles, passes a happy-path run, and still produces wrong results. A finding is **Confirmed** only with a failing test or reproduced output. Otherwise it is **Unverified**.

## Patterns

| # | Pattern | Detect | Prove |
|---|---|---|---|
| 1 | Check-then-act race (read stock, then write stock without transaction/atomic update) | read order/stock handlers; look for SELECT then UPDATE split | fire N concurrent requests; stock goes negative or oversold |
| 2 | Float arithmetic on money (`price * qty * 1.07`) | grep `toFixed`, `\* 0\.`, floats in totals | `0.1 + 0.2` style case; total off by a cent |
| 3 | `async` callback inside `forEach` / unawaited promise | eslint `@typescript-eslint/no-misused-promises`, `no-floating-promises`; grep `forEach\(async` | response sent before work finishes; DB shows partial writes |
| 4 | Pagination off-by-one (`page * size` vs `(page-1) * size`, `<=` vs `<`) | read OFFSET/LIMIT math | page 1 skips first rows; last page missing |
| 5 | Timezone / date handling (`new Date()` string compare, local vs UTC) | grep `new Date\(`, `toLocaleDateString` | test around midnight / DST |
| 6 | Swallowed errors (`catch {}` or `catch (e) { console.log(e) }` and continue) | eslint `no-empty`; grep `catch` | force a failure; API returns 200 |
| 7 | Missing await on DB/IO call | `no-floating-promises` | race on startup or write-then-read |
| 8 | Wrong HTTP status / missing return after `res.send` (double send) | tsc + read handlers | "Cannot set headers after they are sent" |
| 9 | Unhandled null/undefined (`rows[0].x` with no row) | `tsc --strict`; read | request unknown id -> 500 |
| 10 | Discount/tax order of operations, negative or >100% discount accepted | read total calc | quantity -1, discount 150 |
| 11 | Type coercion: `req.query.page` string used as number | tsc strict, read | `?page=abc` -> NaN in SQL |
| 12 | Resource leaks (DB handles, timers, listeners never closed) | read startup/shutdown | process does not exit on SIGTERM |

## Procedure
1. Run `npx tsc --noEmit --strict` and `npx eslint src`; collect hits as `scanner` evidence.
2. Read handlers and services against the table; list candidates.
3. For each candidate write a minimal vitest test in `demo-app/tests/bugs/` that fails on the current code. Run it.
4. Keep passing-by-accident or non-reproducible candidates in the Unverified section.

Never modify `src/` while hunting. Only add test files.
