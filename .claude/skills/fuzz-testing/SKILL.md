---
name: fuzz-testing
description: Property-based and HTTP fuzz testing for the Node/Express order API in demo-app. Generates hostile and random inputs for every endpoint, checks universal oracles (no 5xx, no crash, no leak, JSON errors, bounded latency) plus domain invariants (stock, money, authorization, pagination), shrinks failures to a minimal request, and keeps a regression corpus. Use for /fuzz, before a release, and whenever an endpoint or validation rule changes.
---

# Fuzz testing the API

Fuzzing finds what example-based tests miss: inputs nobody thought of. It needs **oracles** (how to tell a run went wrong without knowing the "right" answer) and **reproducibility** (a seed, a shrunk counterexample, a corpus). Without those it is just noise.

Implementation lives in `demo-app/tests/fuzz/` (fast-check + vitest). **Never edit `src/`** while fuzzing; the harness runs the built app, `dist/index.js`, as a child process in a throwaway temp directory with its own empty SQLite file, so the real `orders.db` is never touched.

## Files

| File | Role |
|---|---|
| `harness.ts` | starts/stops the built server on a free port, `call()` with timeout, `login()` |
| `oracles.ts` | `assertRobust` (crash, 5xx, stack/SQL/hash leak, latency) and `assertJsonErrors` (4xx must be JSON) |
| `payloads.ts` | hostile-string dictionary + fast-check arbitraries (wrong types, missing fields, malformed bodies, odd ids) |
| `api.fuzz.test.ts` | one property per route (`ENDPOINTS` table), auth-header fuzz, oversized/odd bodies, round-trip, search |
| `invariants.fuzz.test.ts` | stateful command sequences, parallel orders, pagination, IDOR/role checks |
| `pricing.fuzz.test.ts` | in-process properties for the pure `calculateTotals` (fast; thousands of cases/second) |
| `regressions.ts` + `.fuzz.test.ts` | permanent corpus of requests that once broke the app |
| `config.ts` | `FUZZ_RUNS`, `FUZZ_SEED` |

## Running

```bash
cd demo-app
npm run fuzz                       # build + all fuzz suites; 100 runs/property, fixed seed => deterministic (PR gate)
FUZZ_RUNS=500 npm run fuzz         # deeper local run
npm run fuzz:nightly               # 2000 runs, fresh seed each night (explores new inputs)
FUZZ_SEED=123 npm run fuzz         # replay the exact failing run from a report
npx vitest run tests/fuzz/api.fuzz.test.ts -t "POST /api/orders"   # one route
```

Always rebuild first (`npm run build`): the fuzzer exercises `dist/`, so a stale build tests old code.

## Oracles (a violation is a bug without any spec)

1. Server process still alive after the request (crash = critical).
2. Status < 500 for any client-controlled input.
3. Body has no stack frame, `node_modules`/absolute path, `SQLITE_`/`SqliteError`, `TypeError:` or bcrypt hash.
4. 4xx responses are JSON (`application/json`), never framework HTML.
5. Response time < 2 s (catches algorithmic DoS, e.g. huge strings/regex/bcrypt on giant input).
6. Bad/forged `Authorization` header always yields exactly 401 (incl. `alg:none`, wrong signature, expired).

## Domain invariants (state the property, let the fuzzer find the counterexample)

- Stock is always an integer >= 0; price finite and >= 0; a **rejected** order changes nothing; an accepted order lowers stock by exactly the ordered sum (duplicate lines included) and only accepts positive integer quantities.
- `total = subtotal - discount + tax`; `0 <= discount <= subtotal`; money values are whole cents; negative/NaN/Infinity subtotals are rejected or neutralised.
- Parallel orders never oversell: `sold <= stock`, `final = stock - sold`.
- Paging every page returns each row once, none missing.
- User B cannot read user A's order; non-admin cannot read revenue or write the catalogue.
- Search returns only rows containing the term (catches UNION injection and unescaped `%`/`_`, which return **200**, so the 5xx oracle alone would miss them).

## Procedure

1. `cd demo-app && npm run build`. Read `src/routes.ts`; diff its routes against `ENDPOINTS` in `api.fuzz.test.ts`. **Every route must have an entry**; add missing ones (body fields via `bodyOf`/`maybeField`, ids via `idSegment`, query via `queryValue`). Add new business rules as invariants.
2. Run `npm run fuzz` (add `FUZZ_RUNS=500` for a release check). Do not skip, loosen or delete a failing property to get green.
3. For each failure record: test name, **seed** and counterexample from the fast-check message, the request/response from `Caused by:`. Group failures with the same root cause (e.g. 8 endpoints 500 on non-string input = one missing validation layer).
4. Classify with `prod-readiness-gate` severities: crash/injection/data-leak/IDOR = Critical or High; 5xx on bad input, invalid state accepted = High/Medium; HTML error body, missing cents rounding = Low/Medium.
5. Rule out fuzzer mistakes before reporting: replay with the printed seed, confirm the request by hand with `curl` against a temp server, and check the failure message matches the claimed oracle. A failure caused by the test setup is not a finding.
6. Write `reports/fuzz.md`: summary counts, table `ID | severity | endpoint | oracle | minimal request | observed | expected | seed`, then root-cause groups with the suggested fix. Report what passed too, with runs and seed, so "no finding" is evidence rather than silence.
7. After a fix lands: add the minimal request to `regressions.ts` (if not already there), re-run, and confirm green with the **same seed** and then a **new seed**.

## Production rules

- **Deterministic CI**: PR runs use the default fixed seed and 100 runs; a red build is reproducible with the printed seed. Exploration happens in the nightly job with a fresh seed (`FUZZ_SEED=$(date +%s)`), which must print the seed on failure and open an issue; never merge a fix without adding the counterexample to the corpus.
- **Safe target only**: fuzz a local or CI instance with a temp DB. Never point it at staging/production data or a shared database, and never at third-party hosts. The payload `'; DROP TABLE ...` is intentional and must only hit a disposable database.
- **No flakiness**: ports are chosen at random free ports, each file starts its own server, files run sequentially (`fileParallelism: false`), every request has a timeout. A flaky fuzz test gets fixed or deleted, never retried.
- **Crash recovery**: `ensureUp()` restarts the server after a crash so one crashing input does not invalidate the remaining runs; the crash itself is still reported.
- **Budget**: keep the PR job under ~3 minutes (lower `FUZZ_RUNS` before dropping a route). bcrypt cost makes auth routes the slowest.
- **Secrets**: the harness passes its own throwaway `JWT_SECRET`; never load real `.env` files into the fuzz process.
- **Adding a CI gate**: add `npm run fuzz` as a job in `.github/workflows/prod-ready.yml` (needs `npm ci` first) and a scheduled workflow for `fuzz:nightly`. Ask before changing workflows.

## Extending beyond this app

The same shape works for any HTTP API: swap the `ENDPOINTS` table and invariants, keep the harness and oracles. For a service with an OpenAPI spec, generate the arbitraries from the schema, then mutate (wrong type, boundary, missing, extra field, oversize). Parsers and other non-HTTP code can use `fc.property` directly (as `pricing.fuzz.test.ts` does).
