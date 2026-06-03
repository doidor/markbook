# Markbook

A lightweight Storybook alternative. Author component documentation as plain
**Markdown**; story components live in adjacent `.tsx` / `.ts` / `.js` files
that the markdown imports via directives. The build emits a static
Starlight-style HTML site, a [Pagefind][pagefind] full-text search index, and
a [`llms.txt`][llmstxt] mirror — plus portable, drop-in embeds for any of
your stories.

> **Status:** v0.9 — chrome customization, `:::stories` directive, story
> portability, three framework adapters (React, Vue, web components). v1.0
> freezes the public API; until then minor releases may break things.

## Why

- **Markdown-first.** Stories are referenced from CommonMark — no MDX, no JSX
  in your prose. The `llms.txt` falls out for free.
- **One story per file (or many).** Use `:::story{src=…}` for one renderer
  per file, or `:::stories{src=…}` to fan out to every named export.
- **Framework-agnostic core.** Adapters mount React, Vue, or web components
  into placeholder elements; the core knows nothing about any of them.
- **Stories that escape the docs site.** `markbook bundle` produces either
  self-contained ESM embeds (drop-in `<script type="module">` on any page) or
  publishable npm packages with the framework as a peer dep.
- **Search, dark mode, themes, custom CSS.** Pagefind, `[data-theme]` token
  flipping, three layers of customization (`css` / `disableBaseCss` /
  `transformHtml`).

## Install

```bash
pnpm add -D markbook @markbook/core @markbook/adapter-react
pnpm add react react-dom  # or vue, or nothing for web components
```

## Hello world

```
docs/
  index.md
  Button/
    Button.stories.tsx
markbook.config.ts
```

`docs/index.md`:

```md
---
title: Button
---

# Button

:::story{src=./Button/Button.stories.tsx}
:::
```

`docs/Button/Button.stories.tsx`:

```tsx
export default () => <button type="button">Hello</button>;
```

`markbook.config.ts`:

```ts
import { defineConfig } from '@markbook/core';
import { reactAdapter } from '@markbook/adapter-react/config';

export default defineConfig({
  title: 'My Components',
  adapter: reactAdapter(),
});
```

Then:

```bash
pnpm markbook dev      # live HMR
pnpm markbook build    # static site in dist/
pnpm markbook bundle   # portable embeds in dist/embed/
```

## Documentation

| Package | Purpose |
| --- | --- |
| [`markbook`](packages/cli) | The `markbook` CLI (`build`, `dev`, `bundle`) |
| [`@markbook/core`](packages/core) | Markdown parser, builder, dev server, embed bundler |
| [`@markbook/adapter-react`](packages/adapter-react) | Mount React stories |
| [`@markbook/adapter-vue`](packages/adapter-vue) | Mount Vue stories |
| [`@markbook/adapter-wc`](packages/adapter-wc) | Mount vanilla web components |

For architectural decisions see [`DECISIONS.md`](DECISIONS.md). For the
running development journal see [`PROGRESS.md`](PROGRESS.md).

## Repository layout

```
packages/
  core/             — markdown + builder + dev server + embed bundler
  cli/              — `markbook` binary (cac + jiti)
  adapter-react/    — React mount + controls + decorators
  adapter-vue/      — Vue 3 mount + decorators
  adapter-wc/       — Web-components mount (no framework runtime)
examples/
  react-demo/       — Pixie component library — the canonical dogfood
  vue-demo/         — Counter component in Vue
  wc-demo/          — <click-counter> custom element
  embed-host/       — external consumer of the React demo's embed bundles
```

## Workspace scripts

```bash
pnpm install                 # bootstrap the workspace
pnpm build                   # compile every @markbook/* package
pnpm test                    # run @markbook/core's Vitest suite
pnpm typecheck               # tsc --noEmit across the workspace
pnpm lint                    # biome check
pnpm example:dev             # React demo dev server (HMR)
pnpm example:build           # build the React demo to dist/
pnpm example:bundle          # bundle React demo stories as ESM embeds
pnpm example:embed-host:serve  # serve the embed-host pages
pnpm example:vue:dev|build|bundle
pnpm example:wc:dev|build|bundle
```

## License

Internal Microsoft project — license TBD before v1.0.

[pagefind]: https://pagefind.app/
[llmstxt]: https://llmstxt.org/
