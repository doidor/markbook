import { defineConfig } from '@markbook/core';

/**
 * Markdown-only demo: no adapter, no React/Vue/WC peer deps. Every page
 * is plain CommonMark; each page's frontmatter `title:` flows into the
 * browser tab, the header brand (since no `config.title` is set), and the
 * `<h1>` lede.
 *
 * Styling: the `nord` preset shipped via the `markbook-style` skill.
 */
export default defineConfig({
  // Intentionally NO `title:` — each page's frontmatter title wins.
  description: 'A Markbook-built static site demonstrating the markdown-only path.',
  css: ['./markbook.css'],
});
