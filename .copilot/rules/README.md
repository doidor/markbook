# Rules (reflexes, glob-scoped, auto-loaded)

Rules are short reminders that apply to specific file types. Each rule's
frontmatter declares a `glob:` — the rule is auto-loaded into context when an
agent edits a file matching that glob.

## Format

```
.copilot/rules/<name>.md
```

```yaml
---
name: core-no-framework
description: Forbid framework imports in @markbook/core
glob: packages/core/**/*.{ts,tsx}
priority: 100  # higher number = applied first; specialized rules win
---
```

Body is the rule — keep it short. If a rule grows past one screen, convert it
into a skill (see `.copilot/skills/`).

## Priority order

When multiple rules match the same file, they're applied highest-priority-first.
The convention is:

- `100+` — specialized package rules (e.g. `core-no-framework`)
- `50–99` — process rules (e.g. `progress-on-package-edit`)
- `0–49` — global style / formatting hints

## Catalogue

| Rule | Scope | Reason |
| --- | --- | --- |
| [`core-no-framework`](core-no-framework.md) | `packages/core/**/*.ts` | Keep the engine framework-agnostic |
| [`tests-co-located`](tests-co-located.md) | `packages/**/*.test.ts` | Vitest convention + import-from-sibling rule |
| [`progress-on-package-edit`](progress-on-package-edit.md) | `packages/**/*` | Don't forget the PROGRESS update |
