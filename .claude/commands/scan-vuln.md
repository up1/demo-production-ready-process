---
description: Scan AI-generated code for security vulnerabilities (semgrep, gitleaks, npm audit + review)
argument-hint: [path, default demo-app]
---

Use the `security-auditor` agent to audit `$ARGUMENTS` (default: `demo-app/`). Tell it to follow the `owasp-review` skill and write `reports/security.md`.

When it finishes, show me the severity counts and the top 3 findings with file:line and evidence. Say which ones scanners found and which only the agent found.
