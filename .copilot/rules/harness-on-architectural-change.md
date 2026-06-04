---
name: harness-on-architectural-change
description: Architectural / public-API changes must also update the agent harness — AGENTS.md, package READMEs, ROADMAP.md, and the wiki when a new gotcha class lands — not just PROGRESS.md
glob: packages/**/src/{index,internal,config}.ts
priority: 65
---

# harness-on-architectural-change

A `PROGRESS.md` entry tells future readers **what changed**. The agent harness
tells future agents **how to think about it**. They are different artefacts and
both need updating when the public surface or architecture moves.

## When this rule applies

Any of the following counts as an architectural / new-feature change:

- A new symbol added to `packages/<name>/src/index.ts` (the public-API barrel).
- A new field on `MarkbookConfig`, `MarkbookAdapter`, or any other public type
  in `packages/core/src/config.ts`.
- A new directive grammar (`:::name{...}`) or a new built-in directive.
- A new frontmatter key (`title`, `template`, `id`, `component`, `layout`, ...
  category-level additions, not values).
- A new CLI command or a new global flag on an existing command.
- A new customization layer (anything that extends the chrome story beyond
  the current four: `css` → `disableBaseCss` → `layoutsDir` → `transformHtml`).
- A new example demo under `examples/<new-name>/`.
- A new SEO / build-time emission (sitemap.xml, robots.txt, llms.txt, og.png,
  …) or a new opt-out for one.
- A package-level dependency change that affects the peer-dep contract.

## What to update in the same commit

In order of cost — cheapest first; do all that apply:

1. **`PROGRESS.md`** — append a journal entry (`/progress-log` skill).
2. **`packages/<name>/README.md`** — the public surface for that package.
   New exports MUST be documented here before they're considered shipped.
3. **`AGENTS.md`**'s "Where to look first" table — add a row if a future
   agent would have to grep for the answer otherwise.
4. **`packages/<name>/AGENTS.md`** — add a package-specific rule if the new
   surface comes with constraints future contributors might miss
   (e.g. "BUILTIN_DIRECTIVES is immutable", "config.directives keys cannot
   collide with built-ins").
5. **`ROADMAP.md`** — add the new symbol/contract to the v1.0 freeze surface,
   or update the Status sentence if the addition shifts the project state.
6. **`README.md`** — update the Status block, the Why bullets, the directory
   map, or the workspace-scripts table if the change is user-visible at the
   top level.
7. **`DECISIONS.md`** — add an ADR for any choice with non-obvious tradeoffs.
8. **`.copilot/wiki/<topic>.md`** — add an entry if implementing this surface
   uncovered a non-obvious gotcha that the next contributor would re-hit.

## When this rule does NOT apply

- Internal refactor with no exported-symbol change.
- Test-only changes.
- Documentation-only changes (those ARE harness updates).
- README typo fixes.
- Bug fix that restores documented behaviour (still gets a PROGRESS entry,
  but the harness was already correct).

## Enforcement

- **Stop hook:** `.claude/hooks/stop-harness-check.mjs` checks at session
  end. If `packages/*/src/{index,config}.ts` changed but none of
  `AGENTS.md` / `packages/*/AGENTS.md` / `packages/*/README.md` /
  `ROADMAP.md` / `README.md` did, it emits a reminder.
- **PostToolUse hook:** `.claude/hooks/post-edit-reminder.mjs` already
  surfaces a one-liner whenever an agent edits anything under `packages/`.
  This rule auto-loads into context whenever a matching file is edited.
- Both hooks are advisory (they cannot block a commit) — that's deliberate.
  The pre-commit gate is lint + typecheck + tests; harness drift is a
  social/judgement call, not a CI failure.

## See also

- [`progress-on-package-edit`](progress-on-package-edit.md) — sibling rule for
  the journal entry.
- [`/progress-log`](../skills/progress-log/SKILL.md) skill — journal format.
- [`AGENTS.md`](../../AGENTS.md) — the "Where to look first" table that
  needs updating when a future agent would otherwise grep for the answer.
