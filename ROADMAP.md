# Markbook roadmap

Forward-looking work, ordered by priority. The current state is **v0.6** — adapters expose a `decorators[]` array (replacing the single `wrapper`) for stacked global providers; the React + Vue adapters honour it, and embed / package bundles inline the same stack for portability (see `PROGRESS.md` for details).

## v0.7 — Per-story metadata, parameters, and prop controls

Optional `parameters` export on stories (background, viewport, layout). Interactive prop controls layered on the existing props table (toggle `disabled`, change `variant`, etc., with the rendered story re-mounting on each change).

## v0.8 — Dark mode + theme tokens

Toggle between light and dark via `data-theme` (already on `<html>`); add a header switch. Expose `--mb-*` CSS variables as a documented theming surface so consumers can override colours/spacing without forking the CSS.

## v1.0 — Stable API freeze

Once the above is solid, freeze `markbook.config.ts`, the directive grammar, the adapter contract, the wrapper/decorator API, and the embed/package output formats. After v1.0 these become semver-stable.
