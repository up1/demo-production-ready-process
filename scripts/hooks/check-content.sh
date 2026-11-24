#!/usr/bin/env bash
# PreToolUse (Write|Edit): block code that breaks the structure/quality rules. Exit 2 = block.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; source "$here/lib.sh"
input="$(cat)"
path="$(jq -r '.tool_input.file_path // empty' <<<"$input")"
[[ "$path" == *.ts && "$path" == */demo-app/* ]] || exit 0
content="$(jq -r '.tool_input.content // .tool_input.new_string // empty' <<<"$input")"
[[ -z "$content" ]] && exit 0

violations="$(content_violations "$path" <<<"$content")"
if [[ -n "$violations" ]]; then
  echo "BLOCKED: $path breaks project rules (route -> controller -> service -> repository -> db):" >&2
  echo "$violations" | sed 's/^/  - /' >&2
  echo "Fix the code and retry. Rules: .claude/skills/maintainable-api-structure/SKILL.md" >&2
  exit 2
fi
exit 0
