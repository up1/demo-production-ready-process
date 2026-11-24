#!/usr/bin/env bash
# SessionStart: put the structure rules in context (stdout is added as context).
cat <<'TXT'
Project rules (enforced by hooks, ESLint and scripts/check-structure.sh):
- Flow: route -> controller -> service -> repository -> db. Each layer imports only the next one.
- Files: demo-app/src/modules/<feature>/<feature>.{routes,controller,service,repository,schemas,test}.ts; shared code in http/, domain/, config.ts, constants.ts, logger.ts.
- No any, no console.*, no process.env outside config.ts, no SQL outside *.repository.ts, no magic numbers.
- Gate: cd demo-app && npm run verify
TXT
