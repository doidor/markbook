# Task: review the pending change

Review the patch in this worktree. Compare HEAD against HEAD~1 — that diff is
the change up for review.

**Read `RULES.md` first.** It documents this project's load-bearing
architectural invariants. The fixture's directory layout mirrors a real
Markbook-style monorepo: `src/core/` is the framework-agnostic engine,
`src/adapter-react/` is the React adapter. Different rules apply to each.

You are an **independent reviewer**. Your goal is:

1. Identify any *real* bugs (correctness, security, off-by-one, data loss).
2. Identify any **architectural-rule violations** documented in `RULES.md`.
3. Decide whether to **block** the change (`severity: "blocking"`) on each
   finding.
4. Do NOT flag cosmetic refactors, internal-consistency changes, or
   correctly-scoped framework usage as blocking.

When done, write a structured review to `./review.json` in the worktree:

```json
{
  "verdict": "block" | "accept",
  "findings": [
    {
      "file": "src/<path>",
      "line_start": <int>,
      "line_end": <int>,
      "severity": "blocking" | "non-blocking",
      "description": "what's wrong and why",
      "suggestion": "how to fix it"
    }
  ]
}
```

The oracle scores you on (a) whether you found the architectural violation
in the right file, (b) whether you blocked, (c) whether you stayed quiet on
the innocuous changes (both the cosmetic refactor and the legitimately-placed
framework import).

When done, summarize your review in plain English too.
