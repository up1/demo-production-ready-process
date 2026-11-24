#!/usr/bin/env bash
# Table-driven tests for the hook scripts. Usage: bash scripts/hooks/tests/run.sh
set -uo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
H="$root/scripts/hooks"; D="$root/demo-app/src"
pass=0; failn=0

expect() { # name expected_exit script json
  local name="$1" want="$2" script="$3" json="$4" got
  echo "$json" | "$H/$script" >/dev/null 2>&1; got=$?
  if [[ $got -eq $want ]]; then pass=$((pass+1)); else failn=$((failn+1)); echo "FAIL: $name (want $want got $got)"; fi
}
w() { jq -n --arg p "$1" --arg c "$2" '{tool_input:{file_path:$p,content:$c}}'; }

# --- check-path ---
expect "path: valid module file"       0 check-path.sh "$(w "$D/modules/orders/orders.service.ts" x)"
expect "path: flat routes.ts"          2 check-path.sh "$(w "$D/routes.ts" x)"
expect "path: wrong module prefix"     2 check-path.sh "$(w "$D/modules/orders/products.service.ts" x)"
expect "path: unknown layer suffix"    2 check-path.sh "$(w "$D/modules/orders/orders.helper.ts" x)"
expect "path: controller allowed"      0 check-path.sh "$(w "$D/modules/orders/orders.controller.ts" x)"
expect "path: dist blocked"            2 check-path.sh "$(w "$root/demo-app/dist/app.js" x)"
expect "path: .env blocked"            2 check-path.sh "$(w "$root/demo-app/.env" x)"
expect "path: .env.example allowed"    0 check-path.sh "$(w "$root/demo-app/.env.example" x)"
expect "path: outside demo-app/src"    0 check-path.sh "$(w "$root/README.md" x)"

# --- check-content ---
S="$D/modules/orders/orders.service.ts"; C="$D/modules/orders/orders.controller.ts"
R="$D/modules/orders/orders.routes.ts";  P="$D/modules/orders/orders.repository.ts"
expect "content: clean service"        0 check-content.sh "$(w "$S" "import * as repo from './orders.repository';")"
expect "content: console.log"          2 check-content.sh "$(w "$S" "console.log('x');")"
expect "content: any"                  2 check-content.sh "$(w "$S" "const a: any = 1;")"
expect "content: as any"               2 check-content.sh "$(w "$S" "const a = b as any;")"
expect "content: Math.random"          2 check-content.sh "$(w "$S" "const t = Math.random();")"
expect "content: forEach(async"        2 check-content.sh "$(w "$S" "xs.forEach(async (x) => {});")"
expect "content: empty catch"          2 check-content.sh "$(w "$S" "try { a(); } catch (e) {}")"
expect "content: process.env in svc"   2 check-content.sh "$(w "$S" "const p = process.env.PORT;")"
expect "content: process.env config"   0 check-content.sh "$(w "$D/config.ts" "const p = process.env.PORT;")"
expect "content: sql concat"           2 check-content.sh "$(w "$P" "db.prepare('SELECT * FROM t WHERE a=' + x)")"
expect "content: routes -> service"    2 check-content.sh "$(w "$R" "import * as s from './orders.service';")"
expect "content: routes -> controller" 0 check-content.sh "$(w "$R" "import * as c from './orders.controller';")"
expect "content: routes has logic"     2 check-content.sh "$(w "$R" "if (x) { y(); }")"
expect "content: controller -> repo"   2 check-content.sh "$(w "$C" "import * as r from './orders.repository';")"
expect "content: controller -> db"     2 check-content.sh "$(w "$C" "import db from '../../db';")"
expect "content: dq import -> db"     2 check-content.sh "$(w "$C" 'import db from "../../db";')"
expect "content: controller -> svc"    0 check-content.sh "$(w "$C" "import * as s from './orders.service';")"
expect "content: service -> express"   2 check-content.sh "$(w "$S" "import { Request } from 'express';")"
expect "content: service -> db"        2 check-content.sh "$(w "$S" "import db from '../../db';")"
expect "content: service uses req"     2 check-content.sh "$(w "$S" "const u = req.user;")"
expect "content: sql in service"       2 check-content.sh "$(w "$S" "db.prepare('SELECT 1').get()")"
expect "content: repo -> service"      2 check-content.sh "$(w "$P" "import * as s from './orders.service';")"
expect "content: repo -> db"           0 check-content.sh "$(w "$P" "import db from '../../db';")"
expect "content: impure domain"        2 check-content.sh "$(w "$D/domain/pricing.ts" "import db from '../db';")"
expect "content: tests may use env"    0 check-content.sh "$(w "$D/modules/orders/orders.test.ts" "process.env.X = '1';")"
expect "content: edit new_string"      2 check-content.sh '{"tool_input":{"file_path":"'"$S"'","new_string":"console.log(1)"}}'

# --- check-readonly ---
ro() { echo "$(w "$1" x)" | "$H/check-readonly.sh" /reports/ /tests/ >/dev/null 2>&1; echo $?; }
[[ "$(ro "$root/reports/security.md")" == 0 ]] && pass=$((pass+1)) || { failn=$((failn+1)); echo "FAIL: readonly allows reports"; }
[[ "$(ro "$D/app.ts")" == 2 ]] && pass=$((pass+1)) || { failn=$((failn+1)); echo "FAIL: readonly blocks src"; }

# --- stop-gate loop guard ---
expect "stop: active flag skips"       0 stop-gate.sh '{"stop_hook_active":true}'

echo "passed=$pass failed=$failn"; [[ $failn -eq 0 ]]
