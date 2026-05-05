---
description: Append a new entry to PROGRESS.md in the standard Markbook journal format
---

Append exactly one new entry to the end of `PROGRESS.md` at the repo root. Use today's date.

Format:

```
## YYYY-MM-DD — short title

**What changed:** one or two sentences, concrete.
**Why:** the user-facing or architectural reason.
**Next:** the one or two follow-ups that should come after this.
```

Rules:
- Do not edit existing entries.
- Keep the entry to those three fields. No code blocks, no bullet lists.
- Be specific about what changed (file paths, package names) but stay terse.
- If the change is architecturally non-obvious, also add a new ADR to `DECISIONS.md` and reference it in the entry.
