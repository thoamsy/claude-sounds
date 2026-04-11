---
name: verify
description: Run tests and type-check to verify changes before marking work done.
---

Run the following checks and report results:

1. `bun test` — all tests must pass
2. `bunx tsc --noEmit` — no type errors

If either fails, show the error and fix it before reporting success.
