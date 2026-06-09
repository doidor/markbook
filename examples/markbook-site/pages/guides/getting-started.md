---
title: Getting started
description: Install Markbook, scaffold a project, write your first page, run the dev server.
order: 1
---

# Getting started

Five minutes from zero to a running site.

> Snippets below use `pnpm`. Substitute `npm install` / `yarn add` / `bun add`
> as needed — Markbook is package-manager-agnostic.

## 1. Install

```bash
pnpm add -D @doidor/markbook @doidor/markbook-core
```

If you only need a markdown-driven site (no component stories), skip the adapter — Markbook's default `staticAdapter` handles markdown-only sites out of the box. To add React component stories in your pages, also install the adapter and the framework runtime:

```bash
pnpm add -D @doidor/markbook-adapter-react
pnpm add react react-dom
```

> React is the only adapter available today. Vue and Web Components adapters are [planned](https://github.com/doidor/markbook/blob/main/ROADMAP.md).

## 2. Create `markbook.config.ts`

At the root of your project:

```ts
import { defineConfig } from '@doidor/markbook-core';

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

With just the four steps above: auto-generated left-nav (subdirectories become groups), on-this-page TOC from your headings, dark-mode toggle persisted to `localStorage`, full-text search via Pagefind (`Cmd/Ctrl+K`), heading-permalink copy-to-clipboard, `/llms.txt` index + per-page `.txt` mirrors, and "View / Copy as Markdown" buttons on every page.

## Next steps

- [Adding component stories →](./adding-stories.html) — wire up the React adapter and mount component examples.
- [Customization →](./customization.html) — change colors, swap the HTML shell, or post-process pages.
- [Config reference →](../reference/config.html) — every field of `MarkbookConfig`.
