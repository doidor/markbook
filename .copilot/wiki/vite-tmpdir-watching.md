# Vite's watcher doesn't see files outside its `root`; chokidar handles user content

**Symptom:** During `markbook dev`, editing a markdown file under `docs/` or
a `*.stories.tsx` story file does not trigger a regen. Vite's HMR works for
component sources (e.g. `src/pixie/Button.tsx`) but the rest of the project
feels dead.

**Root cause:** `markbook dev` runs Vite's `createServer` with `root: tmpDir`
(the `.markbook/` directory where generated HTML + entry scripts live).
Vite's built-in watcher only crawls the module graph rooted at this directory.
Story files imported by the generated entries ARE in the graph (so they HMR),
but markdown files, templates, and `css:` paths are NOT — they're consumed at
parse time, before any module the watcher knows about.

**Fix:** A dedicated `chokidar` watcher (added as a `@markbook/core` dep)
runs alongside Vite, watching `docsDir`, every `templatesDir` entry, every
`cssPaths` entry, and every absolute path of every story file referenced by
any directive (collected by `writePages` and returned in
`WritePagesResult.storyFiles`). On change it re-runs `writePages` and
broadcasts `server.ws.send({ type: 'full-reload', path: '*' })`.

Vite + chokidar split:

| Watcher | Watches |
| --- | --- |
| Vite (built-in) | Module graph (story `.tsx` files, components they import, CSS modules) |
| chokidar (`build.ts` dev path) | User content: markdown, templates, `css:` files, story file paths (for export-list changes) |

The two never overlap. Story `.tsx` content edits hot-reload via Vite;
adding a new export or renaming the file is caught by chokidar.

**Prevention:**
- When adding any new watched file class (e.g. a future YAML sidecar), wire it
  through chokidar — don't expect Vite to find it.
- Always include the dev-mode cache-invalidation step
  (`invalidateExportsCache`, `invalidateCodeCache`) for story-file changes,
  otherwise the next parse uses stale source.

**See also:**
- ADR-0010 (if it exists) and the v0.3 PROGRESS entry for the original split rationale.
