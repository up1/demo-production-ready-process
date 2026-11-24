#!/usr/bin/env bash
# PreToolUse for read-only agents: allow Write/Edit only to the given path fragments. Exit 2 = block.
# Usage: check-readonly.sh /reports/ [/tests/ ...]
set -uo pipefail
path="$(jq -r '.tool_input.file_path // empty' <<<"$(cat)")"
[[ -z "$path" ]] && exit 0
for allowed in "$@"; do [[ "$path" == *"$allowed"* ]] && exit 0; done
echo "BLOCKED: this agent is read-only on source; it may only write under: $*" >&2
exit 2
