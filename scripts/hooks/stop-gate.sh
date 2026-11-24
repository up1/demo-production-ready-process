#!/usr/bin/env bash
# Stop / SubagentStop: do not let Claude finish while the gate is red. Exit 2 = keep working.
set -uo pipefail
input="$(cat)"
[[ "$(jq -r '.stop_hook_active // false' <<<"$input")" == "true" ]] && exit 0   # avoid infinite loops
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
# Only gate when demo-app source/tests changed.
git -C "$root" status --porcelain -- demo-app/src demo-app/tests 2>/dev/null | grep -q . || exit 0
cd "$root/demo-app" || exit 0
out="$( (npm run --silent typecheck && npm run --silent lint && npm run --silent test && npm run --silent structure) 2>&1)" || {
  echo "Gate failed. Fix before finishing:" >&2; echo "$out" | tail -40 >&2; exit 2; }
exit 0
