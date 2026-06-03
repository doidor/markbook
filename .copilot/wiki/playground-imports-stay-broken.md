# Playground sandboxes ship the story source verbatim — in-repo imports stay broken

**Symptom:** Click "Open in CodeSandbox" or "Open in StackBlitz" on a story
that imports from a relative path (e.g.
`import { Button } from '../../../src/pixie/Button.js'`). The sandbox opens,
the file appears, but the build fails inside the playground because the
relative import doesn't resolve — those component sources don't live in the
sandbox.

**Root cause:** The Markbook playground integration ships only the story file
itself (plus its sibling CSS imports) into the sandbox. It does NOT rewrite
relative imports, traverse module graphs, or copy in-repo source files. This
is a deliberate tradeoff — Markbook would have to make assumptions about your
module resolution that would frequently be wrong.

**Fix:** None — by design. The sandbox is a faithful copy of the story file.
The user is expected to edit the imports to either (a) use the npm-published
version of the component (the common case for a real component library), or
(b) inline the component source.

**Prevention:**
- For a real component library that's npm-published, the imports usually look
  like `import { Button } from '@my-org/components'`. Those work as-is in the
  sandbox because the playground's generated `package.json` declares
  dependencies via `MarkbookConfig.playground.dependencies`.
- For demo / in-repo components (Pixie is the canonical example), document
  the limitation in the docs site. The sandbox is still useful as a starting
  point — readers see the JSX, the rendered output in the docs, and can swap
  the imports themselves.
- If your project really needs zero-edit sandboxes for in-repo components,
  the path forward is a new `MarkbookConfig.playground.inlineSourceImports`
  hook that maps import-specifier patterns to glob-loaded source files
  bundled into the sandbox. Not implemented; track via an issue or skill if
  the need surfaces.

**First observed:** 2026-06-03 session, while shipping the
"Open in playground" feature (see PROGRESS.md entry of the same date).
