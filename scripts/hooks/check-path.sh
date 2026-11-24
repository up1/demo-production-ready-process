#!/usr/bin/env bash
# PreToolUse (Write|Edit): block files outside the allowed layout. Exit 2 = block.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; source "$here/lib.sh"
input="$(cat)"
path="$(jq -r '.tool_input.file_path // empty' <<<"$input")"
[[ -z "$path" ]] && exit 0

case "$path" in
  */demo-app/dist/*|*/.env|*/.env.*.local|*.key|*/package-lock.json)
    [[ "$path" == *.env.example ]] || { echo "BLOCKED: $path is generated/secret; do not edit it by hand." >&2; exit 2; } ;;
esac

if [[ "$path" =~ /demo-app/src/(.+)$ ]]; then
  rel="${BASH_REMATCH[1]}"
  if ! layout_ok "$rel"; then
    echo "BLOCKED: src/$rel is outside the allowed layout." >&2
    echo "Use modules/<feature>/<feature>.{routes,controller,service,repository,schemas,test}.ts, http/, domain/, or the root files config|constants|logger|db|app|server|seed.ts (see maintainable-api-structure skill)." >&2
    exit 2
  fi
fi
exit 0
