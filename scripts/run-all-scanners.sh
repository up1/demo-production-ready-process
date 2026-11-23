#!/usr/bin/env bash
# Baseline: run every scanner with NO AI. Output goes to reports/scanner-only/.
# Used in the demo to compare "scanners alone" vs "scanners + agents".
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/reports/scanner-only"
mkdir -p "$OUT"
cd "$ROOT/demo-app" || exit 1

run() { # name, outfile, command...
  local name=$1 file=$2; shift 2
  echo "== $name"
  "$@" >"$OUT/$file" 2>&1 || true
  echo "   -> reports/scanner-only/$file ($(wc -l <"$OUT/$file" | tr -d ' ') lines)"
}

run "semgrep"        semgrep.txt   semgrep scan --config p/javascript --config p/typescript --config p/owasp-top-ten --metrics=off --quiet src
run "gitleaks"       gitleaks.txt  gitleaks detect --no-git --source . --redact --no-banner
run "npm audit"      npm-audit.txt npm audit --omit=dev
run "tsc --strict"   tsc.txt       npx tsc --noEmit --strict
run "eslint"         eslint.txt    npx eslint src
run "jscpd"          jscpd.txt     npx jscpd src --min-tokens 40 --reporters console
run "knip"           knip.txt      npx knip
run "vitest+cov"     vitest.txt    npx vitest run --coverage
echo "Done."
