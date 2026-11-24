# order-api

Express + TypeScript + SQLite order API.

## Structure
`route -> controller -> service -> repository -> db` (see `.claude/skills/maintainable-api-structure/SKILL.md`).
Layer imports are enforced by ESLint (`eslint.config.mjs`), by `scripts/check-structure.sh`, and by Claude Code hooks in `.claude/settings.json`.

```
src/config.ts logger.ts constants.ts db.ts app.ts server.ts seed.ts
src/http/        auth, errors, errorHandler, body
src/domain/      pure functions (pricing)
src/modules/<feature>/<feature>.{routes,controller,service,repository,schemas,test}.ts
```

## Commands
| | |
|---|---|
| `npm run dev` | run with reload |
| `npm run seed` | seed demo data |
| `npm test` | unit + endpoint tests (in-memory SQLite) with coverage thresholds |
| `npm run verify` | typecheck, lint, tests, knip, audit, structure check (the CI gate) |
| `npm run fuzz` | build and run the fuzz suite |

Config: copy `.env.example`; endpoints `GET /health`, `GET /ready`.
