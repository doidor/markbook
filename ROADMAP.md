# Markbook roadmap

Forward-looking work, ordered by priority. The current state is **v0.7** — stories may export `args`, `argTypes`, and `parameters`; React's adapter renders interactive prop controls below each story; all adapters honour `parameters` (layout, background); embed + package bundles inline args/parameters for portability (see `PROGRESS.md` for details).

## v0.8 — Dark mode + theme tokens

Toggle between light and dark via `data-theme` (already on `<html>`); add a header switch. Expose `--mb-*` CSS variables as a documented theming surface so consumers can override colours/spacing without forking the CSS.

## v1.0 — Stable API freeze

Once the above is solid, freeze `markbook.config.ts`, the directive grammar, the adapter contract, the wrapper/decorator API, and the embed/package output formats. After v1.0 these become semver-stable.
