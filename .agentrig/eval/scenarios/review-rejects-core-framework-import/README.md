# Scenario: the reviewer rejects a framework import sneaked into core

A **repo-specific** dynamic-eval scenario. The fixture is a tiny mini-monorepo
that mirrors Markbook's `packages/core/` ↔ `packages/adapter-react/` split —
the load-bearing invariant of the real project (Critical Rule #2, encoded
in `.copilot/rules/core-no-framework.md` and verbatim in this fixture's
`RULES.md`).

The fixture has two snapshots:

1. **`fixture/baseline/`** — known-good state. `src/core/` is pure
   (no framework imports). `src/adapter-react/` imports `react` and
   `react-dom/client`, as adapters are allowed to.
2. **`fixture/change/`** — the patch under review. It contains **three**
   modifications:
   - **Planted violation** — `src/core/parse.js` adds
     `import { createElement } from 'react'` and uses it to wrap the parsed
     AST as a React element. This breaks the no-framework-imports-in-core
     invariant: core's tree-shake guarantee dies the moment any consumer
     pulls it in, every consumer drags React along regardless of which
     adapter they chose.
   - **Cosmetic, not a bug** — `src/core/template.js` extracts the inline
     placeholder regex into a named `PLACEHOLDER_RE` constant. Same
     behaviour; pure refactor. A reviewer who blocks on this has poor
     signal-to-noise.
   - **Allowed framework usage** — `src/adapter-react/mount.js` adds a new
     `useEffect` import alongside the existing `createElement`, and exposes
     a `useMountEffect` helper. This is the architecturally-correct home
     for framework imports; blocking here is cargo-cult application of the
     rule.

## The reviewer's job

Produce `review.json` (schema in `prompt.md`) that:

- Lists a finding on `src/core/parse.js` with `severity: "blocking"`.
- Sets the top-level `verdict` to `"block"`.
- Does **not** mark `src/core/template.js` blocking.
- Does **not** mark `src/adapter-react/mount.js` blocking.

## Oracle

- `finding_correctness`: review.json exists AND has a finding on
  `src/core/parse.js`.
- `blocking_decision`: the parse.js finding is marked `severity: "blocking"`
  AND the top-level verdict is `"block"`.
- `false_positive_rate`: no `blocking` finding on `src/core/template.js`;
  no `blocking` finding on anything under `src/adapter-react/`.

Soft axes (`severity_calibration`, `coverage`, `actionability`,
`independence`) are scored by the LLM judge using the producer transcript
+ `review.json` + the diff.

## What a defect looks like

- Reviewer misses the planted violation entirely — `identified-core-framework-import`
  fails.
- Reviewer flags the violation but only as `non-blocking` ("style") —
  `blocking-on-core-violation` fails.
- Reviewer blocks on the cosmetic `template.js` refactor — `did-not-block-on-cosmetic`
  fails (false positive).
- Reviewer applies the "no react imports" rule cargo-cult-style to the
  adapter — `did-not-block-on-allowed-adapter-import` fails (false positive).
- Reviewer sets `verdict: "accept"` while listing a blocking finding —
  `verdict-block` fails (internal inconsistency).
