import { defineConfig } from '@markbook/core';

/**
 * The official Markbook site, built with Markbook.
 *
 * Hybrid layout strategy:
 *
 *   - `index.md` opts into the `landing` HTML layout (custom hero, big
 *     typography, no sidebar).
 *   - Every other page uses Markbook's built-in shell (header + left nav
 *     + content + right TOC) — the chrome users get out of the box,
 *     dogfooded.
 *
 * BASE_CSS is ON; `markbook.css` overrides the `--mb-*` tokens to a
 * violet-on-slate palette and adds the landing-page-specific classes.
 */
export default defineConfig({
  contentDir: 'pages',
  title: 'Markbook',
  description:
    'A library that renders markdown into HTML, with adapters for React, Vue, and web components — so it can also do component-library showcases like Storybook.',
  layoutsDir: 'layouts',
  css: ['./markbook.css'],
  siteUrl: 'https://microsoft.github.io/markbook',
  themeColor: '#a78bfa',
  playground: false,
});
