# Markbook roadmap

Forward-looking work, ordered by priority. The current state is **v0.9** — chrome customization (`css`, `disableBaseCss`, `transformHtml`) and per-story styling via CSS modules + auto-detected PostCSS for stories (see `PROGRESS.md` for details).

## v1.0 — Stable API freeze

Once the above is solid, freeze `markbook.config.ts`, the directive grammar, the adapter contract, the decorator API, the embed/package output formats, the `--mb-*` theme tokens, and the story-file conventions (`args`, `argTypes`, `parameters`, frontmatter `id=`/`component:`/`template:`). After v1.0 these become semver-stable.
