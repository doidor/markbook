import { defineConfig } from '@markbook/core';
import { callout } from './directives/callout.js';

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
 *
 * `directives.callout` is imported from `./directives/callout.ts` to
 * demonstrate the "external file" pattern — handlers are just modules,
 * and jiti loads the whole config tree, so TS imports work
 * transitively. Useful when the registry grows past a couple of entries.
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
  directives: {
    callout,
  },
});
