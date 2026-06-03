import { defineConfig } from '@markbook/core';

/**
 * Cumulus — a fictional cloud-platform marketing site.
 *
 * The polar opposite of the React / Vue / WC docs demos. Demonstrates
 * Markbook's deepest customization layers without writing JS in the config:
 *
 *   - `contentDir: 'pages'` — pages live under `pages/`, not `docs/`.
 *     `docsDir` is the legacy alias; new sites should use `contentDir`.
 *   - `disableBaseCss: true` — Markbook ships ZERO chrome CSS. Every
 *     selector lives in `cumulus.css`.
 *   - `layoutsDir: 'layouts'` + `layout: 'default'` — Markbook's built-in
 *     `<html>`/`<head>`/`<body>` shell is REPLACED by `layouts/default.html`
 *     for every page. `index.md`'s frontmatter overrides this with
 *     `layout: landing` for a hero-style treatment.
 *   - `llmsButtons: false` — no per-page "View as Markdown" buttons. The
 *     layout's footer instead exposes a single "All pages as markdown ↓"
 *     link to `/llms.txt`. Search is still wired up — the layout drops
 *     `{{ search }}` into the top nav.
 *
 * Search and llms.txt extraction are ON by default. Marketing sites can
 * opt into them just by including the right placeholders in the layout.
 */
export default defineConfig({
  contentDir: 'pages',
  layoutsDir: 'layouts',
  layout: 'default',
  description: 'Cumulus — cloud infrastructure that gets out of your way.',
  disableBaseCss: true,
  css: ['./cumulus.css'],
  llmsButtons: false,
});
