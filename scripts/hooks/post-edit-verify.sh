#!/usr/bin/env bash
# PostToolUse (Write|Edit): lint + typecheck the project after a TS edit. Exit 2 feeds the errors back to Claude.
set -uo pipefail
input="$(cat)"
path="$(jq -r '.tool_input.file_path // empty' <<<"$input")"
[[ "$path" == *.ts && "$path" == */demo-app/* ]] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}/demo-app" || exit 0
out="$(npx --no-install eslint --max-warnings 0 "$path" 2>&1 && npx --no-install tsc --noEmit 2>&1)" || { echo "$out" >&2; exit 2; }
exit 0
