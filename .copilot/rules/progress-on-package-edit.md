---
name: progress-on-package-edit
description: Any change under packages/** that affects user-facing behaviour, public APIs, or architecture requires a PROGRESS.md entry in the same commit
glob: packages/**/*
priority: 70
---

# progress-on-package-edit

If you edit anything under `packages/` and the change is non-trivial, append
an entry to `PROGRESS.md` in the same commit. Use the
[`/progress-log`](../skills/progress-log/SKILL.md) skill — it enforces the
correct format.

## When this rule applies

- New public API symbol (exported from `index.ts` of any package)
- New `MarkbookConfig` field
- New directive grammar / frontmatter key
- Bug fix that affects observable behaviour
- Refactor that changes the file/folder shape
- Dependency bump that changes peer-dep contract or runtime behaviour

## When this rule does NOT apply

- Internal refactor with no observable difference (e.g. extracting a helper without changing call sites)
- Test-only changes
- Comment / formatting changes
- README typo fixes (still good to commit, just no PROGRESS entry needed)

## Enforcement

The harness `Stop` hook (`.claude/hooks/stop-progress-check.mjs`) warns at
session end if `packages/**` changed but `PROGRESS.md` didn't. The
`PostToolUse` hook reminds during the session. Don't ignore either signal —
write the entry while context is fresh.

## See also

- [`/progress-log`](../skills/progress-log/SKILL.md) skill
- The journal entry format at the top of `PROGRESS.md`
