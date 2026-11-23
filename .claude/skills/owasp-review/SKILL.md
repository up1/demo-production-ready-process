---
name: owasp-review
description: Checklist of security flaws AI coding assistants commonly introduce in Node.js/Express/SQL code, mapped to OWASP Top 10, with the tool or grep that proves each one. Use when auditing code for vulnerabilities.
---

# OWASP review for AI-generated Node/Express code

Every finding needs evidence: a scanner hit, a grep match with file:line, or a working exploit request. No evidence = "Unverified".

## Checklist (what AI usually gets wrong)

| # | Pattern | OWASP | How to prove it |
|---|---|---|---|
| 1 | SQL built by string concatenation / template literal | A03 Injection | semgrep; grep `` `SELECT.*\$\{ `` and `"\s*\+\s*` near `.prepare(`/`.exec(`; try `' OR 1=1--` |
| 2 | Hard-coded secret (JWT secret, API key, password) | A02 Crypto / A07 Auth | gitleaks; grep `secret\s*=\s*['"]` |
| 3 | Route handles another user's data without ownership check (IDOR) | A01 Broken Access Control | read the handler: is `req.user.id` compared to the resource owner? call it as user B |
| 4 | Missing auth middleware on mutating routes | A01 | list routes, check which lack the auth middleware |
| 5 | `Math.random()` / `Date.now()` used for tokens, ids, reset codes | A02 | grep `Math\.random` |
| 6 | Weak or missing password hashing (plain, md5, sha1, unsalted) | A02 | grep `createHash\(['"](md5\|sha1)` and plain comparisons |
| 7 | CORS `*` or `cors()` with defaults on authenticated API | A05 Misconfig | grep `cors\(` |
| 8 | No rate limit on login | A07 | grep for `rate-limit`; absent = finding |
| 9 | Dependencies with known CVEs, unpinned or outdated | A06 | `npm audit --omit=dev` |
| 10 | Verbose errors / stack traces returned to client | A05 | grep `err\.stack`, `res.*err` |
| 11 | No input validation / type trust on `req.body`, `req.query` | A03 | read handlers; absence of zod/joi/manual checks |
| 12 | JWT without expiry, `alg` not pinned, secret reused | A07 | grep `jwt.sign\(` options |
| 13 | Mass assignment (`Object.assign(user, req.body)`, spreading body into DB) | A01 | grep `\.\.\.req\.body` |

## Severity guide
- Critical: unauthenticated injection, auth bypass, hard-coded production secret
- High: IDOR, missing auth on write routes, exploitable CVE in a reachable path
- Medium: missing rate limit, permissive CORS, weak token generation without direct exploit
- Low: verbose errors, missing headers

## Reporting
Use the finding table in the `prod-readiness-gate` skill. Mark source as `scanner` or `AI-found`.
