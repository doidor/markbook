# Markbook roadmap

Forward-looking work, ordered by priority. The current state is **v0.5 (embed mode)** — `markbook bundle` produces self-mounting ESM modules from any story (see `PROGRESS.md` for details). Package mode + shadow-DOM isolation are still pending.

---

## v0.5.1 — Story portability follow-ups (ADR-0006)

Remaining pieces of ADR-0006 not shipped in v0.5:

1. **Stories as packages** — `markbook bundle <story-id> --mode package` produces a publishable npm package directory exporting `mount(el)` (and a `<MountStory />` convenience for React), so consumers `npm i @org/story-foo` and call `mount(target)` from any framework or vanilla page. Framework runtime as a peer dep.
2. **Shadow-DOM isolation** — `--isolation=shadow` flag wraps the mount in a shadow root so host-page CSS doesn't leak in or out.
3. **Stable IDs via frontmatter** — currently slugs are derived from the story file path. Add a frontmatter `id:` override so users can rename files without breaking external embeds.

## v0.6 — Config-time decorators (multiple, ordered)

Generalise the single `wrapper` option (added in v0.1) to a `decorators` array (Storybook-style). Useful once users want layered wrappers (theme + i18n + router, etc.).

## v0.7 — Per-story metadata, parameters, and prop controls

Optional `parameters` export on stories (background, viewport, layout). Interactive prop controls layered on the existing props table (toggle `disabled`, change `variant`, etc., with the rendered story re-mounting on each change).

## v0.8 — Dark mode + theme tokens

Toggle between light and dark via `data-theme` (already on `<html>`); add a header switch. Expose `--mb-*` CSS variables as a documented theming surface so consumers can override colours/spacing without forking the CSS.

## v1.0 — Stable API freeze

Once the above is solid, freeze `markbook.config.ts`, the directive grammar, the adapter contract, the wrapper/decorator API, and the embed/package output formats. After v1.0 these become semver-stable.
