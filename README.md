# Markbook

A lightweight Storybook alternative. Author component documentation as plain
**Markdown**; story components live in adjacent `.tsx` / `.ts` / `.js` files
that the markdown imports via directives. The build emits a static
Starlight-style HTML site, a [Pagefind][pagefind] full-text search index, and
a [`llms.txt`][llmstxt] mirror — plus portable, drop-in embeds for any of
your stories.

> **Status:** v0.10+ — chrome customization, `:::stories` directive, story
> portability, three framework adapters (React, Vue, web components),
> `config.directives` extension model for user-defined directives plus an
> `htmlTemplate(source)` helper for handlers whose output lives in `.html`
> files, SEO defaults (canonical + OG + Twitter + sitemap.xml + robots.txt),
> a `public/` folder for static assets, and a `preview` command. v1.0
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
- **Search, dark mode, themes, custom CSS, HTML layouts.** Pagefind,
  `[data-theme]` token flipping, and four layers of customization
  (`css` / `disableBaseCss` / `layoutsDir` / `transformHtml`) so the same
  engine can render docs sites, marketing sites, or anything in between.
- **Extensible directives.** Beyond the three built-ins (`:::story`,
  `:::stories`, `:::props`), register your own with `config.directives` —
  `:::callout`, `::youtube`, `:::csv-table`, anything. Handlers are plain
  TS functions; the `htmlTemplate(source)` helper lets directive markup
  live in real `.html` files (with `{{ key }}` substitution) instead of
  inline JS template literals.

## Install

```bash
pnpm add -D markbook @markbook/core @markbook/adapter-react
pnpm add react react-dom  # or vue, or nothing for web components
```

After installing, run `markbook skills install` to drop agent-CLI skills (`markbook-init`, `markbook-add-component-page`, `markbook-bulk-generate`, `markbook-style`, `markbook-bundle-story`) into your project's `.claude/skills/` (or `.codex/`, `.opencode/`, `.agents/`). Then your agent can scaffold pages, bulk-generate from an existing component library, apply visual presets, etc. — see [`packages/cli/README.md`](packages/cli/README.md#markbook-skills-action) for the full skill catalogue.

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
  static-demo/      — Skyline: a markdown-only docs site, no adapter
  marketing-demo/   — Cumulus: a marketing site with a fully custom layout
                      (disableBaseCss + layouts/*.html + contentDir: 'pages')
  markbook-site/    — the official Markbook website (hybrid: custom landing
                      + default chrome for guides/reference). Markdown-only.
  embed-host/       — external consumer of the React demo's embed bundles
```

## Workspace scripts

```bash
pnpm install                 # bootstrap the workspace
pnpm build                   # compile every @markbook/* package
pnpm test                    # run @markbook/core's Vitest suite
pnpm typecheck               # tsc --noEmit across the workspace
pnpm lint                    # biome check

# Run every example dev server in parallel — color-coded, one Ctrl-C
# stops them all. URLs printed at startup. Add new examples in
# scripts/examples-dev.mjs.
pnpm examples:dev            # all 6 dev servers on ports 5173-5178
pnpm examples:build          # build all 6 examples in parallel

# Per-example scripts (each runs on the default port 5173 when invoked alone)
pnpm example:dev             # React demo dev server (HMR)
pnpm example:build           # build the React demo to dist/
pnpm example:bundle          # bundle React demo stories as ESM embeds
pnpm example:embed-host:serve  # serve the embed-host pages
pnpm example:vue:dev|build|bundle
pnpm example:wc:dev|build|bundle
pnpm example:static:dev|build      # markdown-only docs site (no adapter)
pnpm example:marketing:dev|build   # fully custom layout via HTML layouts + disableBaseCss
pnpm example:site:dev|build|preview  # the official Markbook site (hybrid layout)
```

## License

Internal Microsoft project — license TBD before v1.0.

[pagefind]: https://pagefind.app/
[llmstxt]: https://llmstxt.org/
