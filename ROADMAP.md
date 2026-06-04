# Markbook roadmap

Forward-looking work, ordered by priority. The current state is **v0.10+** — `:::stories` directive (multi-export story files with CSF v3 support), per-export sliced code disclosures, `@markbook/core` public/internal API split, full READMEs for every package, GitHub Actions CI, **`config.directives` extension model** (ADR-0025) for user-defined directives + the `htmlTemplate(source)` helper for `.html`-templated handler output, **SEO defaults** (canonical + OG + Twitter + sitemap.xml + robots.txt, all emitted in build and dev), a **`public/` folder** for static assets, a **`markbook preview` command** for serving `dist/` locally, and the **official Markbook site** (`examples/markbook-site/`) as a self-hosted documentation showcase.

## v1.0 — Stable API freeze

Once the deferred carve-outs land (or are explicitly punted to v1.x), freeze `markbook.config.ts`, the three built-in directives (`:::story`, `:::stories`, `:::props`) and their attributes, the **user-directive API** (`config.directives`, `DirectiveHandler`, `DirectiveContext`, `DirectiveResult`, `BUILTIN_DIRECTIVES`, `escapeHtml`/`escapeAttribute`/`htmlTemplate`), the adapter contract, the decorator API, the embed/package output formats, the `--mb-*` theme tokens, the customization API (`css` / `disableBaseCss` / `layoutsDir` / `transformHtml`), the SEO output shape (sitemap.xml + robots.txt schema + the canonical/OG/Twitter `<head>` block), the `public/` static-asset contract, the CSF v3 detection rule, and the story-file conventions (`args`, `argTypes`, `parameters`, frontmatter `id=`/`component:`/`template:`). After v1.0 these become semver-stable; bump every package to `0.1.0` and ship.

## Deferred (post-freeze, additive)

- **Shadow-DOM CSS injection.** Embed bundles inject `<style>` into `document.head`, which doesn't reach shadow roots. The story renders unstyled inside the shadow.
- **Vue + WC props tables.** `:::props` currently delegates to `react-docgen-typescript` (React-only). A `vue-component-meta`-based path and a custom-elements-manifest path are both feasible.
- **Vue + WC interactive controls.** `hasControls: false` on both adapters today. Equivalent `setupControls` implementations should be straightforward.
- **WC decorators.** Custom-element slot composition is a different mental model; supporting `decoratorModules` cleanly probably means a slot-projection helper rather than the React/Vue wrapping pattern.
