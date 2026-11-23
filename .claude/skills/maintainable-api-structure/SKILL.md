---
name: maintainable-api-structure
description: Project structure, typing, config, logging, testing and lint rules that prevent technical debt in Node/Express/TypeScript APIs (SQL in route handlers, `any`, magic numbers, no tests, console.log, copy-paste). Use BEFORE creating files or endpoints and when deciding where code belongs.
---

# Maintainable API structure (prevent technical debt)

Each rule maps to a dimension in the `debt-analyst` rubric (`tech-debt-rubric`).

## 1. Layers (no SQL in routes)
```
src/
  config.ts            # the only reader of process.env (zod-validated)
  logger.ts            # pino; no console.log anywhere else
  app.ts               # builds the express app (exported for tests)
  server.ts            # listen + graceful shutdown
  http/                # middleware: auth, requireRole, validate, errorHandler
  modules/<feature>/
    <feature>.routes.ts      # HTTP only: parse, call service, shape response
    <feature>.service.ts     # business rules; no express types
    <feature>.repository.ts  # SQL only; returns typed rows
    <feature>.schemas.ts     # zod schemas + inferred types
    <feature>.test.ts
  domain/pricing.ts    # pure functions, no I/O
```
Routes never import the DB. Services never import express. Repositories contain all SQL.

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
- vitest + supertest against `createApp()` with an in-memory SQLite (`:memory:`) per test.
- Per endpoint minimum: success, validation failure, unauthenticated (401), forbidden/other-user (403/404), not found, and one edge case.
- Pricing/inventory functions: table-driven unit tests.
- Coverage >= 70% lines on `modules/**` and `domain/**`; 100% on pricing and auth.

## 7. Tooling must pass, locally and in CI
Add `npm run verify` = `tsc --noEmit && eslint . && vitest run --coverage && knip && npm audit --omit=dev`.
ESLint rules: `no-floating-promises`, `no-misused-promises`, `no-explicit-any`, `complexity: 10`, `max-lines-per-function: 50`, `no-console`, `eslint-plugin-security`.

## 8. Operability basics
`GET /health` (and `/ready` that checks the DB), structured JSON logs with request ids, config from env with `.env.example` committed (no real values), lockfile committed, `README` with run/test commands.

## When extending an existing codebase
Match the target structure above for new code. If existing code violates it, do not copy the bad pattern. Note it in your report as existing debt and keep your change in the right layer.
