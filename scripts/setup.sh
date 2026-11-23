#!/usr/bin/env bash
# Install and verify every tool used in the workshop.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ok=1

check() { # name, command
  if command -v "$2" >/dev/null 2>&1; then echo "  ok   $1"; else echo "  MISSING $1  ->  $3"; ok=0; fi
}

echo "== System tools =="
check node node "install Node 20+"
check npm npm "install Node 20+"
check semgrep semgrep "brew install semgrep  (or pipx install semgrep)"
check gitleaks gitleaks "brew install gitleaks"

echo "== Node tools (installed in demo-app, run via npx) =="
if [ -d "$ROOT/demo-app" ]; then
  cd "$ROOT/demo-app"
  npm install --no-audit --no-fund >/dev/null 2>&1 && echo "  ok   npm install"
  npm install -D --no-audit --no-fund typescript eslint @eslint/js typescript-eslint \
    eslint-plugin-security jscpd knip vitest @vitest/coverage-v8 supertest @types/supertest \
    >/dev/null 2>&1 && echo "  ok   dev tools (eslint, jscpd, knip, vitest)" || { echo "  FAILED dev tools"; ok=0; }
else
  echo "  demo-app/ not found"; ok=0
fi

[ $ok -eq 1 ] && echo "READY" || { echo "NOT READY"; exit 1; }
