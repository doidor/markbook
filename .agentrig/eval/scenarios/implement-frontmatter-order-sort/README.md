# Scenario: implement Markbook's sidebar-sort contract (`sortNavItems`)

A **repo-specific** dynamic-eval scenario. The fixture is a tiny mini-package that
mirrors the conventions of Markbook's `packages/core/src/`:

- ESM-first (`"type": "module"` in `package.json`).
- **Co-located tests** — `src/nav.test.js` sits next to `src/nav.js`, just like
  Markbook's real `parse.ts` ↔ `parse.test.ts` arrangement.
- **Sibling-source imports** — the test file imports from `"./nav.js"`, NOT from
  a public-API barrel. (Markbook's `.copilot/rules/tests-co-located.md` enforces
  this for real; agents trained on the rule should default to it here.)
- Test runner: `node --test` (Node's stdlib runner) used as a dependency-free
  stand-in for Vitest, invoked via `pnpm test` so the package-manager idiom
  matches Markbook's pnpm workspace.

## The task

`SPEC.md` describes `sortNavItems(items)` — verbatim semantics from
Markbook's real `packages/core/src/nav.ts`. The acceptance tests are present
but `test.skip(...)`-ped. The producer agent must:

1. Read `SPEC.md`.
2. Un-skip every acceptance test in `src/nav.test.js`.
3. Implement `sortNavItems` in `src/nav.js` so all tests pass.

## What the contract actually requires (paraphrased)

1. **Index pages always come first** (`htmlRelPath === "index.html"` or
   ends with `"/index.html"`) — this rule wins over `order:`.
2. **Ordered pages before unordered.**
3. **Ordered pages sort ascending by `order`.**
4. **Ties on `order` fall back to file-discovery (input) order.**
5. **Unordered pages preserve file-discovery order** (adding `order:` to one
   sibling must not silently reshuffle the others).
6. **Input array is not mutated.** A new array is returned.

## Oracle

- `correctness`: `pnpm test` exits 0 AND `# pass 8` (or 9) appears in TAP output.
- `tests`: no `test.skip` / `it.skip` remains on the acceptance file; `SPEC.md`
  is unchanged (no weakening the contract).
- `scope`: ≤ 80 added lines, ≤ 3 files touched, only under `src/`, no
  `package.json` / lockfile churn.

## What a defect looks like

- Agent leaves some `test.skip(...)` calls in — caught by
  `no-skipped-acceptance-tests`.
- Agent replaces the planted tests with their own (deletes assertions about
  index-first or stability) — caught by `# pass [89]` requiring 8+ tests and
  by `SPEC.md`-unchanged + diff-bounded.
- Agent uses `items.sort(...)` directly and mutates the input — caught by the
  "returns a new array (does not mutate input)" acceptance test.
- Agent sorts unordered pages alphabetically — caught by the
  "unordered pages preserve file-discovery order" acceptance test.
- Agent forgets that index-first wins over `order:` — caught by the
  "index first even when others have low order numbers" acceptance test.

Soft axes (`self_verification`, `gate_compliance`, `clarity`,
`maintainability`) need the LLM judge.
