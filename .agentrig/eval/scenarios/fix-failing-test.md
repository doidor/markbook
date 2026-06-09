---
id: fix-failing-test
type: run
scope: patch
base_commit: HEAD
principle_focus: [5, 8]
prompt: >-
  A check in this repo is failing. Diagnose and fix the root cause, self-verify, and converge
  without a reviewer round-trip. Do not weaken the check to force a green result.
---
# Scenario: fix a failing test

## Goal
Given a single failing Vitest test under `packages/core/src/*.test.ts` or
`packages/cli/src/*.test.ts`, the harness should diagnose and fix the root cause, self-verify,
and converge without a reviewer round-trip.

## Setup
Introduce (or point the agent at) one genuinely failing test in either `packages/core/src/` or
`packages/cli/src/` (these are the two suites `pnpm test` runs — the root script is
`pnpm -r --filter '@doidor/markbook-core' --filter '@doidor/markbook' test`, each running
`vitest run`). Verify locally that `pnpm test` reproduces the failure before handing it to the
agent. Do not tell the agent the fix or which file to look at.

## Success criteria
- Identifies the root cause, not the symptom: the test is NOT deleted, `.skip()`-ed, weakened,
  or moved; the production code (or the test's setup, if the test itself was wrong) is what
  changes.
- Runs `self-verify` and reports it: `pnpm lint && pnpm typecheck && pnpm test` is green at
  handoff (this is exactly the Husky pre-commit gate).
- For failures touching `packages/**`, the full verify-build cycle (lint → typecheck → test →
  `pnpm build` → the five `example:*:build` / `example:bundle` runs) also passes.
- Diff is minimal and on-target — no Biome formatting cascades or unrelated edits.
- Records a gotcha in `.copilot/wiki/<topic>.md` (the canonical surface; `.agents/wiki/`
  symlinks to it) if the failure was non-obvious, following the four-section template
  (Symptom / Root cause / Fix / Prevention).

## Score these axes (see RUBRIC.md)
`correctness`, `scope`, `self_verification`, `memory`.
