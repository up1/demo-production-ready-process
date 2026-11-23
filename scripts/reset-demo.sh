#!/usr/bin/env bash
# Restore demo-app to the committed (flawed) state and clear generated reports.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
git checkout -- demo-app/src 2>/dev/null || true
git clean -fdq demo-app/src demo-app/tests 2>/dev/null || true
rm -f demo-app/*.db
find reports -type f ! -name .gitkeep -delete 2>/dev/null || true
echo "Demo reset."
