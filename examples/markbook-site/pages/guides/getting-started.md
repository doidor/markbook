---
title: Getting started
description: Install Markbook, scaffold a project, write your first page, run the dev server.
---

# Getting started

Five minutes from zero to a running site.

## 1. Install

```bash
pnpm add -D markbook @markbook/core
```

(Or `npm install --save-dev` / `yarn add -D` — Markbook works with any package manager.)

If you want React / Vue / web-component stories in your pages, also add the corresponding adapter and the framework runtime:

```bash
# React
pnpm add -D @markbook/adapter-react
pnpm add react react-dom

# Vue
pnpm add -D @markbook/adapter-vue
pnpm add vue

# Web components — no adapter dependency, no runtime
pnpm add -D @markbook/adapter-wc
```

If you only need a markdown-driven site (no component stories), skip the adapter — Markbook's default `staticAdapter` handles markdown-only sites out of the box.

## 2. Create `markbook.config.ts`

At the root of your project:

```ts
import { defineConfig } from '@markbook/core';

export default defineConfig({
  title: 'My Project',
  description: 'A short blurb about the site.',
});
```

That's the minimum viable config. Everything else has sensible defaults.

## 3. Write your first page

Markbook reads markdown from `./pages/` (or `./docs/` — both work; `contentDir` is configurable). Create `pages/index.md`:

```markdown
---
title: Welcome
description: The home page of my site.
---

# Hello, world

This is **markdown**. It becomes HTML.

## A section

- Bullets work
- Code blocks too
- `inline code` and **emphasis** and [links](https://example.com)
```

## 4. Run the dev server

```bash
npx markbook dev
```

```
  Markbook dev server ready:
    ➜  Local:   http://localhost:5173/
```

Open the URL. You'll see your page with the default Markbook chrome (header, sidebar, content, on-this-page TOC, dark-mode toggle, search). Edit `pages/index.md` — the browser refreshes automatically.

## 5. Build for production

```bash
npx markbook build
```

The output lands in `./dist/`. To verify it looks right:

```bash
npx markbook preview     # serves dist/ over HTTP at :4173
```

Don't open `dist/*.html` directly in the browser via `file://` — Pagefind UI loads its runtime via dynamic `import()`, which browsers block for `file://` pages. `markbook preview` (or any other static-file HTTP server) is what you want.

## What you get out of the box

With just the four steps above:

- Multiple markdown pages with auto-generated left-nav grouping (subdirectories become groups)
- On-this-page TOC built from your H2/H3 headings
- Heading-permalink copy-to-clipboard on hover
- Dark-mode toggle, persisted via `localStorage`
- Full-text search via Pagefind (Cmd/Ctrl+K to focus)
- `/llms.txt` index + per-page `.txt` mirrors at `/llms/<page>.txt`
- "View as Markdown" / "Copy as Markdown" buttons on every page

## Next steps

- [Adding component stories →](./adding-stories.html) — wire up an adapter and start mounting React/Vue/web-component examples.
- [Customization →](./customization.html) — change colors, swap the HTML shell, or post-process pages.
- [Search & SEO →](./search-and-seo.html) — turn on canonical URLs, sitemap.xml, and OG tags.
- [Config reference →](../reference/config.html) — every field of `MarkbookConfig`.
