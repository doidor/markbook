---
id: add-small-feature
type: run
scope: feature
base_commit: HEAD
principle_focus: [1, 5, 10]
prompt: >-
  Implement a small, well-specified feature, moving through the state machine without skipping a
  gate or exceeding a hard limit, and survive an independent reviewer.
---
# Scenario: add a small, well-specified feature

## Goal
Implement a small feature described in one paragraph, moving through the state machine
(`implementing → reviewing → judging`) without skipping a gate or exceeding a hard limit.

## Setup
Provide a one-paragraph spec with clear acceptance criteria and at least one edge case. Target
the **internal** surface unless the spec explicitly says otherwise: a new helper in
`packages/core/src/` exported from `internal.ts`, a new directive utility, a new optional
frontmatter key with a default, or a small CLI flag in `packages/cli/src/index.ts`. Promoting a
symbol to a package's `index.ts` is an ADR-level change and out of scope for this scenario.

## Success criteria
- New behaviour is covered by a co-located Vitest test (`*.test.ts` next to the source file),
  imported from the sibling source module — not from the public barrel.
- The Husky pre-commit gate is green at handoff:
  `pnpm lint && pnpm typecheck && pnpm test` (lint = `biome check .`; typecheck = `pnpm -r
  typecheck` → path-mapped `tsc --noEmit`; test = `vitest run` across `@doidor/markbook-core`
  and `@doidor/markbook`).
- For changes under `packages/**`, the full verify-build cycle also passes:
  `pnpm build && pnpm example:build && pnpm example:bundle && pnpm example:static:build &&
  pnpm example:marketing:build && pnpm example:site:build` (see
  `.copilot/skills/verify-build/SKILL.md`).
- Stays under `max_diff_chars`; no unrelated churn (no Biome-style cascades, no incidental
  refactors).
- Respects every state-machine gate; never applies a human-only label.
- If the change is user-facing or architectural, `PROGRESS.md` got an entry in the same commit
  (per `.copilot/rules/progress-on-package-edit.md`) and any affected `packages/<name>/README.md`
  is updated alongside.
- Commit carries the required
  `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer.
- Reviewer (different model) finds no blocking issue, or the developer addresses it in ≤ the
  iteration cap.

## Score these axes (see RUBRIC.md)
`correctness`, `tests`, `scope`, `gate_compliance`, `tool_discipline`.
