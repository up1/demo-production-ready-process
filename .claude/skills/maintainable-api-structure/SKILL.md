---
name: maintainable-api-structure
description: Project structure, typing, config, logging, testing and lint rules that prevent technical debt in Node/Express/TypeScript APIs (SQL in route handlers, `any`, magic numbers, no tests, console.log, copy-paste). Use BEFORE creating files or endpoints and when deciding where code belongs.
---

# Maintainable API structure (prevent technical debt)

Each rule maps to a dimension in the `debt-analyst` rubric (`tech-debt-rubric`).

## 1. Layers: route -> controller -> service -> repository -> db
```
demo-app/src/
  config.ts            # the only reader of process.env
  constants.ts         # named constants (rates, tiers, limits, URLs, status codes)
  logger.ts            # the only writer to stdout/stderr; no console.* anywhere else
  db.ts                # connection + schema; imported only by repositories (and seed.ts)
  app.ts               # createApp() (exported for tests)   server.ts  # listen
  http/                # auth, errors, errorHandler, body: shared HTTP helpers
  domain/              # pure functions, no I/O (pricing)
  modules/<feature>/
    <feature>.routes.ts       # path + middleware -> controller fn. No logic
    <feature>.controller.ts   # parse req, call service, set status/response. No business rules, no SQL
    <feature>.service.ts      # business rules, orchestration, transactions. No express types
    <feature>.repository.ts   # all SQL, typed rows, plain data out
    <feature>.schemas.ts      # input types / validation
    <feature>.test.ts
```
Allowed imports (each layer imports only the next one down, never up):

| File | May import | Must not import |
|---|---|---|
| `*.routes.ts` | its controller, `http/*` middleware, express `Router` | service, repository, db |
| `*.controller.ts` | its service, `http/*`, `constants` | repository, db, routes |
| `*.service.ts` | its repository, `domain/*`, **other modules' services**, `http/errors`, `logger`, `config` | express, db, controller, routes, other modules' repository |
| `*.repository.ts` | `db` | service, controller, express |
| `domain/*` | `constants` | express, db, any I/O |

**Enforced by (blocked, not just discouraged):** ESLint `no-restricted-imports` per file suffix (`demo-app/eslint.config.mjs`), `scripts/check-structure.sh` (CI + Stop hook), and Claude hooks in `.claude/settings.json` (`check-path.sh`, `check-content.sh` before every Write/Edit; `post-edit-verify.sh` after; `stop-gate.sh` before finishing). The `api-developer` agent carries the same hooks in its frontmatter. A violation exits 2 and the edit is rejected with the rule name.

## 2. Types
- `strict: true`. No `any`, no `as any`; use `unknown` and narrow. Row types for every query: `db.prepare(...).get(id) as ProductRow | undefined`.
- Derive request types from zod (`z.infer`), so validation and types cannot drift.
- Domain errors as classes (`HttpError`, `NotFoundError`) handled by one error middleware.

## 3. No magic values
Named constants in one place: `TAX_RATE_BPS`, `DISCOUNT_TIERS`, `MAX_PAGE_SIZE`, `TOKEN_TTL_MS`. Discount tiers are data (an array), not an `if/else` ladder.

## 4. Reuse over copy-paste
If the same logic appears twice, extract it (loading a product, parsing pagination, ownership-scoped queries). Rule of three at the latest.

## 5. Size limits
Function <= 50 lines, cyclomatic complexity <= 10, file <= 300 lines. Split when exceeded.

## 6. Tests ship with the code
- vitest + supertest against `createApp()` with an in-memory SQLite (`DB_PATH=:memory:` via `tests/support/setup.ts`; `resetDb()` per test). Write tests in layer order: repository/service unit, then endpoint.
- Per endpoint minimum: success, validation failure, unauthenticated (401), forbidden/other-user (403/404), not found, and one edge case.
- Pricing/inventory functions: table-driven unit tests.
- Coverage >= 70% lines on `modules/**` and `domain/**`; 100% on pricing and auth.

## 7. Tooling must pass, locally and in CI
`npm run verify` (in `demo-app/`) = typecheck + lint + tests with coverage thresholds + knip + `npm audit --omit=dev` + `scripts/check-structure.sh`. CI runs the same.
ESLint rules: `no-floating-promises`, `no-misused-promises`, `no-explicit-any`, `complexity: 10`, `max-lines-per-function: 50`, `no-console`, `eslint-plugin-security`.

## 8. Operability basics
`GET /health` and `GET /ready` (checks the DB), structured JSON logs with request ids, config from env with `.env.example` committed (no real values), lockfile committed, `README` with run/test commands.

## When extending an existing codebase
Match the target structure above for new code. If existing code violates it, do not copy the bad pattern. Note it in your report as existing debt and keep your change in the right layer.
