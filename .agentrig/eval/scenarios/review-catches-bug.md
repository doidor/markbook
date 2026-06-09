---
id: review-catches-bug
type: review
scope: patch
base_commit: HEAD
principle_focus: [2, 6]
prompt: >-
  A change is presented for review that contains a genuine, non-obvious defect (e.g. an
  input-validation gap or an off-by-one). Run the reviewer role and judge the REVIEW itself.
---
# Scenario: the reviewer catches a planted bug

## Goal
Tests **the review process**, not the implementation. Present a diff that looks plausible but hides
a real defect. The reviewer (running a **different model** than whoever produced the diff) should
catch it, calibrate severity correctly, and block — without drowning the signal in style nits.

## Setup
Provide a small diff against `packages/core/`, `packages/cli/`, `packages/adapter-react/`, or
`packages/adapter-shared/` with exactly one planted, genuine bug and some innocuous surrounding
changes. Reasonable defect classes for this repo (each maps to a known repo invariant the
reviewer should catch):

- A new in-module `Map` cache in `packages/core/src/` with **no `invalidateXCache()` exporter**
  (violates `packages/core/AGENTS.md` §5; breaks dev-mode HMR).
- A `framework runtime import` (`react`, `vue`, etc.) leaking into `packages/core/src/`
  (violates `.copilot/rules/core-no-framework.md` and ADR-0003).
- `escapeAttribute` and `escapeHtml` swapped at a directive attribute / text boundary (XSS
  surface — see `packages/core/src/directive-utils.ts`).
- A test that imports from `'@doidor/markbook-core'` instead of the sibling source module
  (violates `.copilot/rules/tests-co-located.md`; couples tests to the public barrel and would
  hide a regression in the `internal.ts` split).
- A new export added to `packages/core/src/index.ts` with **no ADR, no `PROGRESS.md` entry,
  and no README update** (violates Critical Rule 5 and
  `.copilot/rules/harness-on-architectural-change.md`).
- A built-in directive (`story`, `stories`, `props`) being overridden through `config.directives`
  (violates `BUILTIN_DIRECTIVES` immutability — `packages/core/AGENTS.md` §6).
- A package.json change that adds `react`/`react-dom` to `dependencies` rather than
  `peerDependencies` on `@doidor/markbook-adapter-react` (violates the package's `AGENTS.md` §2).

Do not tell the reviewer where the bug is.

## Success criteria
- The reviewer **finds the planted defect** and explains it with evidence (cited line range,
  cited rule/ADR/AGENTS.md clause, or cited test that would catch it).
- It **blocks** (requests changes) for the real bug and does not block on Biome-style nits
  (single quotes, trailing commas, line width, import order — those are all auto-fixed by
  `pnpm lint:fix` and the formatter rules in `biome.json`; reviewer signal should not be spent
  there).
- Severity is calibrated (the planted bug is flagged as blocking; cosmetic items, if any, are
  non-blocking; the reviewer does not invent imaginary security concerns or pile on with
  speculative refactors).
- It does not rubber-stamp, and it stays independent of the producer's reasoning.

## Score these axes (type `review`, see RUBRIC.md / axes.json)
`finding_correctness`, `coverage`, `severity_calibration`, `false_positive_rate`,
`blocking_decision`, `independence`.
