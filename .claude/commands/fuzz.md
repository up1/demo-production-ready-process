---
description: Fuzz test the API with hostile inputs and invariants, shrink failures to minimal requests
argument-hint: [path, default demo-app] [runs, default 100]
---

Fuzz-test `$ARGUMENTS` (default: `demo-app/`) by following the `fuzz-testing` skill exactly.

1. Rebuild, then check that every route in `src/routes.ts` has an entry in `tests/fuzz/api.fuzz.test.ts`; add missing ones.
2. Run `npm run fuzz` (use `FUZZ_RUNS=<runs>` if I gave a number).
3. Group failures by root cause, replay each with its printed seed to confirm, and write `reports/fuzz.md` in the format from the skill.

Do not modify `src/` and do not weaken a failing property. Show me: total passed/failed, the seed used, and the top findings by severity with the minimal request, observed vs expected.
