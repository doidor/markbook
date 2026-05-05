# Markbook roadmap

Forward-looking work, ordered by priority. The current state is **v0.5.1** — `markbook bundle` supports embed + package modes, optional shadow-DOM isolation, and stable slugs via the directive `id=` attribute (see `PROGRESS.md` for details).

## v0.6 — Config-time decorators (multiple, ordered)

Generalise the single `wrapper` option (added in v0.1) to a `decorators` array (Storybook-style). Useful once users want layered wrappers (theme + i18n + router, etc.).

## v0.7 — Per-story metadata, parameters, and prop controls

Optional `parameters` export on stories (background, viewport, layout). Interactive prop controls layered on the existing props table (toggle `disabled`, change `variant`, etc., with the rendered story re-mounting on each change).

## v0.8 — Dark mode + theme tokens

Toggle between light and dark via `data-theme` (already on `<html>`); add a header switch. Expose `--mb-*` CSS variables as a documented theming surface so consumers can override colours/spacing without forking the CSS.

## v1.0 — Stable API freeze

Once the above is solid, freeze `markbook.config.ts`, the directive grammar, the adapter contract, the wrapper/decorator API, and the embed/package output formats. After v1.0 these become semver-stable.
