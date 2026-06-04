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
 *
 * Search, llms.txt extraction, AND per-page "View / Copy as Markdown"
 * buttons are all ON (Markbook's defaults). The layout drops the
 * `{{ search }}` slot into the top nav, the `{{ pageActions }}` slot above
 * each page's content article, and a `/llms.txt` link in the footer.
 */
export default defineConfig({
  contentDir: 'pages',
  layoutsDir: 'layouts',
  layout: 'default',
  description: 'Cumulus — cloud infrastructure that gets out of your way.',
  // Illustrative siteUrl — turns on canonical, og:url, sitemap.xml, robots.txt.
  // Replace with your real production origin when deploying.
  siteUrl: 'https://cumulus.example',
  themeColor: '#0a1228',
  disableBaseCss: true,
  css: ['./cumulus.css'],
});
