---
description: Find hidden bugs in AI-generated code and prove each with a failing test
argument-hint: [path, default demo-app]
---

Use the `bug-hunter` agent on `$ARGUMENTS` (default: `demo-app/`). Tell it to follow the `bug-pattern-catalog` skill, add failing tests under `demo-app/tests/bugs/`, and write `reports/bugs.md`.

When it finishes, show me confirmed vs unverified counts and the top 3 bugs with the name of the failing test and observed vs expected result.
