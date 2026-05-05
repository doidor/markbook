# Markbook roadmap

Forward-looking work, ordered by priority. The current state is **v0.8** — full dark-mode support with a header toggle, all colours expose as `--mb-*` CSS variables, and Shiki uses dual themes so code blocks follow `[data-theme]` automatically (see `PROGRESS.md` for details).

## v1.0 — Stable API freeze

Once the above is solid, freeze `markbook.config.ts`, the directive grammar, the adapter contract, the wrapper/decorator API, and the embed/package output formats. After v1.0 these become semver-stable.
