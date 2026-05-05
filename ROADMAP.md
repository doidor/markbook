# Markbook roadmap

Forward-looking work, ordered by priority. The current state is **v0.3** (v0.2 + `markbook dev` with HMR — see `PROGRESS.md` for details).

---

## v0.4 — Vue and web-components adapters

Validate the framework-agnostic claim. Mostly a matter of writing two thin packages following the **ADR-0005** browser/config split. Will reveal whether the wrapper API needs to be adapter-agnostic.

## v0.5 — Story portability (ADR-0006)

Two related capabilities for embedding stories outside the Markbook site:

1. **Embeddable bundle** — `markbook bundle <story-id>` produces a self-contained `dist/embed/<story-id>.js` (+ optional `.css`) that auto-mounts when scripted into any HTML page via a `<div data-markbook-embed="<story-id>">` placeholder. **No iframe.**
2. **Stories as packages** — `markbook bundle <story-id> --mode package` produces a publishable npm package directory exporting `mount(el)` (and a `<MountStory />` convenience for React), so consumers `npm i @org/story-foo` and call `mount(target)` from any framework or vanilla page.

Both modes share an isolation strategy (optional `--isolation=shadow` for shadow-DOM containment so host-page CSS doesn't leak in or out). The package mode treats the framework runtime as a peer dep; the embed mode bundles it.

See `DECISIONS.md` § ADR-0006 for the architecture.

## v0.6 — Config-time decorators (multiple, ordered)

Generalise the single `wrapper` option (added in v0.1) to a `decorators` array (Storybook-style). Useful once users want layered wrappers (theme + i18n + router, etc.).

## v0.7 — Per-story metadata, parameters, and prop controls

Optional `parameters` export on stories (background, viewport, layout). Interactive prop controls layered on the existing props table (toggle `disabled`, change `variant`, etc., with the rendered story re-mounting on each change).

## v0.8 — Dark mode + theme tokens

Toggle between light and dark via `data-theme` (already on `<html>`); add a header switch. Expose `--mb-*` CSS variables as a documented theming surface so consumers can override colours/spacing without forking the CSS.

## v1.0 — Stable API freeze

Once the above is solid, freeze `markbook.config.ts`, the directive grammar, the adapter contract, the wrapper/decorator API, and the embed/package output formats. After v1.0 these become semver-stable.
