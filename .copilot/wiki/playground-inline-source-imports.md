# Playground sandboxes — in-repo imports

**Symptom (before fix):** Click "Open in CodeSandbox" / "Open in StackBlitz" on
a story that imports from a relative path (e.g.
`import { Button } from '../../../src/pixie/Button.js'`). The sandbox opens,
the file appears, but the build fails because the relative import doesn't
resolve — those component sources don't live in the sandbox.

**Resolution:** As of `feat(playground): inlineSourceImports`, the playground
config supports an `inlineSourceImports: string[]` of globs (relative to
`MarkbookConfig.root`). When set, Markbook walks each story file's relative
imports — transitively — and any path that matches one of the globs is
included in the sandbox payload at `src/<root-relative-path>`. The original
relative-import paths in the source resolve unchanged.

```ts
// markbook.config.ts
export default defineConfig({
  // ...
  playground: {
    providers: ['codesandbox', 'stackblitz'],
    inlineSourceImports: ['src/pixie/**/*'],
  },
});
```

**Sandbox layout (Pixie example):**

```
src/docs/components/Button/Variants.stories.tsx   ← story (entry imports this)
src/src/pixie/Button.tsx                          ← inlined source
src/src/pixie/Button.module.css                   ← transitively inlined
src/src/pixie/pixie.css                           ← transitively inlined
src/index.tsx                                     ← generated CRA entry
package.json
public/index.html
```

The story's `from '../../../src/pixie/Button.js'` resolves from
`src/docs/components/Button/` to `src/src/pixie/Button.tsx` (CodeSandbox
does `.ts/.tsx` extension resolution automatically).

**Limits:**
- Only **relative imports** are walked. Bare module specifiers (`'react'`)
  stay external and need to be declared in `playground.dependencies`.
- Files outside the configured globs are NOT inlined even if a story imports
  them — this is a deliberate safety gate to keep stories from dragging in
  arbitrary repo source.
- Dynamic `import('…')` is not walked.

**First observed:** 2026-06-03 session, while shipping the
"Open in playground" feature. Fixed in the same day by adding
`inlineSourceImports`.
