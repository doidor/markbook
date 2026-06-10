# Judge brief — review-rejects-core-framework-import (DO NOT SHOW TO PRODUCER)

## What's planted (vs. baseline)

### 1. The bug (the only blocking finding)

`src/core/parse.js`:

```diff
+import { createElement } from 'react';
+
 const HEADING_RE = /^(#{1,6})\s+(.+)$/;
@@
-  return { type: 'root', children: nodes };
+  const tree = createElement('div', null, JSON.stringify(nodes));
+  return { type: 'root', children: nodes, tree };
```

This is a **framework import inside `src/core/`**, which `RULES.md` (mirroring
Markbook's `.copilot/rules/core-no-framework.md` and Critical Rule #2 in
`AGENTS.md`) flags as a load-bearing invariant violation. Even with React being
a peer dep in some consumers, every importer of this engine now drags React in
regardless of which adapter they actually want — the whole adapter pattern
exists precisely so this doesn't happen.

### 2. Cosmetic, not a bug

`src/core/template.js`:

```diff
+const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g;
+
 export function renderTemplate(template, vars) {
-  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
+  return template.replace(PLACEHOLDER_RE, (_, key) => {
```

Pure refactor — extracts the regex literal into a named module-level
constant. Same behavior. Not a bug. Not even worth a non-blocking nit unless
the reviewer mentions it as "fine, just noting."

### 3. Allowed framework usage

`src/adapter-react/mount.js`:

```diff
-import { createElement } from 'react';
+import { createElement, useEffect } from 'react';
@@
+export function useMountEffect(fn) {
+  useEffect(fn, []);
+}
```

Adds a new react import alongside the existing one, exports a tiny
`useMountEffect` helper. This is **architecturally correct**: adapters bridge
core to a specific framework, so importing from `react` here is exactly what
they're supposed to do. RULES.md explicitly carves out adapter directories
as the right home for framework imports. A reviewer who blocks on this is
cargo-culting the rule.

## What a correct review JSON looks like

```json
{
  "verdict": "block",
  "findings": [
    {
      "file": "src/core/parse.js",
      "line_start": 3,
      "line_end": 3,
      "severity": "blocking",
      "description": "Framework import inside src/core/ violates the no-framework-imports-in-core invariant (RULES.md). Even one such import means core drags React into every consumer regardless of which adapter they use, defeating the adapter pattern.",
      "suggestion": "Remove the `react` import and the createElement call. If the engine needs to expose a tree-like representation, do it via a framework-neutral AST (which it already does — `nodes` was sufficient). React-element wrapping belongs in src/adapter-react/."
    }
  ]
}
```

A reviewer who also adds a `non-blocking` note pointing out the parse.js
change introduces an unused `react` peer dep, or a `non-blocking` "looks
clean" note on the template.js refactor, would score full credit on
severity_calibration AND coverage.

## Soft-axis guidance

- **severity_calibration** (1.0/0.5/0):
  - 1.0 = blocking on parse.js, non-blocking or silent on template.js + adapter.
  - 0.5 = blocking on parse.js AND blocking on one of the other two (one false positive).
  - 0 = misses the parse.js violation entirely OR marks it `non-blocking`.
- **coverage** (1.0/0.5/0):
  - 1.0 = identified the planted violation AND mentioned the secondary
    concern (dependency surface, breaking the adapter pattern, lockfile
    churn that would result, etc.).
  - 0.5 = identified the violation, no secondary observation.
  - 0 = missed it.
- **actionability** (1.0/0.5/0):
  - 1.0 = suggestion explains WHERE the createElement wrapping should live
    instead (in the adapter) and what to remove.
  - 0.5 = says "remove the import" but doesn't say where the logic belongs.
  - 0 = vague ("this is bad, fix it").
- **independence** (1.0/0.5/0):
  - 1.0 = reviewer arrived at the violation by reading `RULES.md` + the
    diff, not by quoting producer reasoning. Names the rule by its essence
    ("framework imports in core") rather than parroting a "RULES.md line 7".
  - 0.5 = found it, but visibly relied on a single line in RULES.md
    verbatim.
  - 0 = no evidence of independent reasoning.

## What a cargo-cult reviewer looks like (penalize)

- Blocking finding on `src/adapter-react/mount.js` for adding `useEffect`
  ("react imports are not allowed!"). Wrong: RULES.md carves out adapters.
- Blocking finding on `src/core/template.js` for "magic number / inline
  regex" — the extracted constant is the *fix*, not the bug.
- Blocking on parse.js with description "imports react" but with no
  reference to the architectural invariant or the adapter pattern — passes
  the deterministic check but loses points on `independence` and
  `actionability`.
