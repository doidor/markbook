# Backticks in CSS comments inside a TS template literal break parsing

**Symptom:** `esbuild` / `vite:esbuild` reports `Expected ";" but found ":"`
on a line inside `BASE_CSS` (a `const BASE_CSS = \`...\`` template literal in
`packages/core/src/build.ts`). The full Vitest run blows up at transform time,
not at runtime — every test that imports from `build.ts` fails.

**Root cause:** The CSS embedded in `BASE_CSS` is inside a backtick template
literal. A CSS comment of the form `/* \`:::stories\` ... */` contains backticks
that terminate the surrounding TS template literal early. esbuild then tries
to parse the trailing CSS as JavaScript and fails on the next colon.

**Fix:** Don't put backticks inside CSS comments that live in a TS template
literal. Use single quotes, asterisks, or just plain words:

```ts
// ❌ — breaks
const BASE_CSS = `
  /* \`:::stories\` fan-out cards */
  .markbook-story-block[data-markbook-group] { ... }
`;

// ✅
const BASE_CSS = `
  /* :::stories fan-out cards */
  .markbook-story-block[data-markbook-group] { ... }
`;
```

The same applies to `${` inside the CSS — that's interpolation in a TS
template literal. Escape with `\${` if you need a literal dollar-brace pair.

**Prevention:**
- Before adding any non-trivial CSS comment to `BASE_CSS`, scan for `` ` ``
  and `${`. If either appears, rephrase or escape.
- `pnpm test` catches this immediately because every test file transitively
  imports `build.ts`. Run [`/verify-build`](../skills/verify-build/SKILL.md)
  before claiming done — the failure mode looks scary but the fix is trivial.

**First observed:** 2026-06-03 session, while adding the
`.markbook-story-block[data-markbook-group]` styles for `:::stories` cards.
