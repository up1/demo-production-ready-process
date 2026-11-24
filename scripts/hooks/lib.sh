#!/usr/bin/env bash
# Shared helpers for deterministic structure checks (no LLM involved).

# Allowed layout under demo-app/src. Succeeds when the path (relative to demo-app/src) is allowed.
ROOT_RE='^(config|constants|logger|db|app|server|seed)\.ts$'
SHARED_RE='^(http|domain)/[a-zA-Z]+(\.test)?\.ts$'
MODULE_RE='^modules/([a-z]+)/([a-z]+)\.(routes|controller|service|repository|schemas|test)\.ts$'
layout_ok() {
  local rel="$1"
  [[ "$rel" =~ $ROOT_RE || "$rel" =~ $SHARED_RE ]] && return 0
  if [[ "$rel" =~ $MODULE_RE ]]; then [[ "${BASH_REMATCH[1]}" == "${BASH_REMATCH[2]}" ]] && return 0; fi
  return 1
}

# Prints the layer name for a file path (by suffix) or nothing.
layer_of() {
  case "$1" in
    *.routes.ts) echo routes ;;
    *.controller.ts) echo controller ;;
    *.service.ts) echo service ;;
    *.repository.ts) echo repository ;;
  esac
}

# Prints violations for a file given its path and content (stdin). One per line: "<rule>: <explanation>".
content_violations() {
  local path="$1" content layer
  content="$(cat)"
  layer="$(layer_of "$path")"
  local is_test=0
  [[ "$path" == *.test.ts || "$path" == */tests/* ]] && is_test=1

  grep -Eq 'console\.(log|info|warn|error|debug)' <<<"$content" && [[ "$path" != */src/logger.ts ]] && echo "no-console: use src/logger.ts, never console.*"
  grep -Eq '(:|as|<)[[:space:]]*any([^A-Za-z]|$)' <<<"$content" && echo "no-any: use unknown and narrow, or a row/interface type"
  grep -Eq 'Math\.random' <<<"$content" && echo "no-math-random: use crypto.randomBytes for tokens"
  grep -Eq 'forEach\([[:space:]]*async' <<<"$content" && echo "no-foreach-async: use for...of or Promise.all/allSettled"
  grep -Eq 'catch[[:space:]]*(\([^)]*\))?[[:space:]]*\{[[:space:]]*\}' <<<"$content" && echo "no-empty-catch: handle or log the error"
  grep -Eq 'process\.env' <<<"$content" && [[ "$path" != */src/config.ts && $is_test -eq 0 ]] && echo "env-only-in-config: read process.env only in src/config.ts"
  grep -Eq '(prepare|exec)\([^)]*(\+|\$\{)' <<<"$content" && echo "no-sql-concat: parameterise SQL with ? placeholders"

  [[ $is_test -eq 1 ]] && return 0
  local imports
  imports="$(grep -E "^import .* from |^import ['\"]|require\(" <<<"$content" | tr '"' "'" || true)"
  case "$layer" in
    routes)
      grep -Eq "\.(service|repository)'|/db'|better-sqlite3" <<<"$imports" && echo "layer-routes: routes may import only controllers and http/ middleware"
      grep -Eq '^[[:space:]]*(if|for|while|switch)[[:space:](]' <<<"$content" && echo "layer-routes: no logic in routes; move it to the service"
      ;;
    controller)
      grep -Eq "\.repository'|/db'|better-sqlite3|\.routes'" <<<"$imports" && echo "layer-controller: controllers may import only services and http/ helpers"
      grep -Eq '\.(prepare|exec)\(|SELECT |INSERT |UPDATE |DELETE FROM' <<<"$content" && echo "layer-controller: no SQL in controllers"
      ;;
    service)
      grep -Eq "from 'express'|/db'|better-sqlite3|\.controller'|\.routes'" <<<"$imports" && echo "layer-service: services may import only repositories, domain and other services; no express/db"
      grep -Eq '\b(req|res)\b[.:]' <<<"$content" && echo "layer-service: services must not touch req/res"
      ;;
    repository)
      grep -Eq "from 'express'|\.service'|\.controller'|\.routes'" <<<"$imports" && echo "layer-repository: repositories import only db"
      ;;
  esac
  case "$path" in
    */src/domain/*) grep -Eq "from 'express'|/db'|better-sqlite3|node:fs|fetch\(" <<<"$imports$content" && echo "domain-pure: domain/ must be pure (no express, db or I/O)" ;;
  esac
  # SQL only in repositories (and db.ts/seed.ts)
  if [[ -n "$layer" && "$layer" != repository ]]; then
    grep -Eq '\.prepare\(' <<<"$content" && echo "sql-in-repository: SQL belongs in *.repository.ts"
  fi
  return 0
}
