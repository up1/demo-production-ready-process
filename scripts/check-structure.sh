#!/usr/bin/env bash
# Deterministic structure check for CI and the Stop hook. Exit 1 on any violation.
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
source "$root/scripts/hooks/lib.sh"
fail=0
report() { echo "STRUCTURE: $*" >&2; fail=1; }

cd "$root/demo-app" || exit 1
while IFS= read -r f; do
  rel="${f#src/}"
  layout_ok "$rel" || report "$f is outside the allowed layout"
  if [[ "$f" != *.test.ts ]]; then
    v="$(content_violations "$root/demo-app/$f" < "$f")"
    [[ -n "$v" ]] && report "$f"$'\n'"$(sed 's/^/    - /' <<<"$v")"
  fi
done < <(find src -name '*.ts' | sort)

# every module file set must have routes, controller, service, repository
for d in src/modules/*/; do
  m="$(basename "$d")"
  for part in routes controller service repository; do
    [[ -f "$d$m.$part.ts" ]] || report "module $m is missing $m.$part.ts"
  done
  [[ -f "$d$m.test.ts" ]] || report "module $m has no $m.test.ts"
done

git -C "$root" ls-files --error-unmatch demo-app/dist >/dev/null 2>&1 && report "demo-app/dist is tracked by git"
[[ -f .env.example ]] || report "missing demo-app/.env.example"
[[ -f README.md ]] || report "missing demo-app/README.md"
[[ -f package-lock.json ]] || report "missing package-lock.json"
exit $fail
