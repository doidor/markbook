---
name: progress-log
description: Append a new entry to PROGRESS.md in the standard Markbook journal format. Replaces the legacy /markbook-log slash command.
trigger: After any change that affects user-facing behaviour, public APIs, or architecture. Also at session end if packages/** was touched but PROGRESS.md wasn't.
allowed-tools: Read Edit
argument-hint: <title>
---

# progress-log

Append **exactly one** new entry to the end of `PROGRESS.md` at the repo root.
Use today's date in ISO-8601 (`YYYY-MM-DD`).

## Format

```
---

## YYYY-MM-DD — short title

**What changed:** one or two sentences, concrete (file paths, package names, test counts).

**Why:** the user-facing or architectural reason.

**Next:** the one or two follow-ups that should come after this. (If genuinely none, say so.)
```

## Rules

- **Do not edit existing entries.** Journal is append-only.
- **Three fields only.** No code blocks, no bullet lists, no nested headings.
- **Be specific.** "Refactored `parse.ts` slot model from 1-to-1 to 1-to-N" beats "Updated parser."
- **If the change is architecturally non-obvious, also add a new ADR to `DECISIONS.md`** and reference it from the entry (e.g. "see ADR-0021").
- **Update READMEs / CLAUDE.md / AGENTS.md / ROADMAP.md in the SAME commit** if affected. Never leave docs out of sync.

## Pre-commit reminder

The harness `PostToolUse` hook (`.claude/hooks/post-edit-reminder.mjs`) flags
edits under `packages/` so you don't forget. The `Stop` hook
(`.claude/hooks/stop-progress-check.mjs`) escalates if you try to end the
session without a PROGRESS update.

## Prevention tests

- Entry date matches the current calendar day (no back-dating without explicit reason).
- Title fits on one line.
- "Next:" actually exists and is concrete — not a placeholder like `TBD`.
