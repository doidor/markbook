# Markbook

**A lightweight, markdown-first Storybook alternative.** Author your docs as
plain `.md`; reference component stories that live in adjacent `.tsx` files via
directives. Markbook builds a static Starlight-style site with full-text
search, dark mode, an [`llms.txt`][llmstxt] mirror, SEO defaults, a sitemap,
and portable embeds of any of your stories.

📖 **[Read the docs →](https://doidor.github.io/markbook)**

> **Status:** pre-1.0. **Only the React adapter ships today** — Vue and Web
> Components adapters are on the [roadmap](ROADMAP.md). The public API is
> documented and largely stable, but minor releases may still break things
> until v1.0 freezes it.

## Why Markbook

- **🤖 Agent-first by default.** Ships six built-in
  [agent skills](https://doidor.github.io/markbook/guides/agent-skills.html)
  (`init`, `add-component-page`, `bulk-generate`, `style`, `layout`,
  `bundle-story`) for Claude Code, Codex, OpenCode, Cursor, and any
  auto-discovering agent CLI. One `npx markbook skills install` and your agent
  knows the conventions — setup is a one-line conversation.
- **📄 Markdown is the source of truth.** Every page is a `.md` file. HTML
  and `llms.txt` are two views of one AST. No MDX, no JSON sidecars, no JS
  templates.
- **🧩 Component stories, optional.** Drop a `:::story` directive into any
  page to mount a live React component. Skip it for a pure docs/marketing
  site. Search, SEO, dark mode, and `llms.txt` are always on.
- **🎨 Four-layer customization.** Token overrides → opt out of base CSS →
  swap the HTML shell → post-process. Pick the smallest layer that solves
  your problem.
- **⚡ Fast dev loop.** Vite under the hood. ~80 ms regeneration on a small
  site, full Pagefind re-index included.

## Install

```bash
pnpm add -D @doidor/markbook @doidor/markbook-core
```

_Works with `npm`, `yarn`, and `bun` too — use whichever your project
already uses._

For live **React stories**, also add the adapter and the framework runtime:

```bash
pnpm add -D @doidor/markbook-adapter-react
pnpm add react react-dom
```

## Quick start

A minimal markdown-only site:

```
my-site/
├─ pages/
│  └─ index.md
└─ markbook.config.ts
```

```ts
// markbook.config.ts
import { defineConfig } from '@doidor/markbook-core';

export default defineConfig({
  title: 'My Project',
  description: 'A short blurb about the site.',
});
```

```markdown
<!-- pages/index.md -->
---
title: Welcome
---

# Hello, world

This is **markdown**. It becomes HTML — with search, dark mode, and a TOC.
```

```bash
npx markbook dev      # live dev server  → http://localhost:5173
npx markbook build    # static site in dist/
npx markbook preview  # serve dist/      → http://localhost:4173
```

> Don't open `dist/*.html` via `file://` — Pagefind loads its runtime
> through dynamic `import()`, which browsers block on `file://`. Use
> `markbook preview`.

To add a component story, wire up the React adapter and drop a `:::story`
directive — see the
[adding component stories guide](https://doidor.github.io/markbook/guides/adding-stories.html).

## Documentation

| Guide | What it covers |
| --- | --- |
| [Getting started](https://doidor.github.io/markbook/guides/getting-started.html) | Install, scaffold, first page, dev server |
| [Agent skills](https://doidor.github.io/markbook/guides/agent-skills.html) | The six shipped skills + how to install them |
| [Adding component stories](https://doidor.github.io/markbook/guides/adding-stories.html) | React adapter, `:::story` / `:::stories`, CSF v3, decorators |
| [Customization](https://doidor.github.io/markbook/guides/customization.html) | Tokens, `disableBaseCss`, layouts, `transformHtml` |
| [Custom directives](https://doidor.github.io/markbook/guides/custom-directives.html) | Register your own `:::name` handlers |
| [Search & SEO](https://doidor.github.io/markbook/guides/search-and-seo.html) | Pagefind, canonical URLs, sitemap, `llms.txt` |
| [CLI reference](https://doidor.github.io/markbook/reference/cli.html) | `build` / `dev` / `preview` / `bundle` / `skills` |
| [Config reference](https://doidor.github.io/markbook/reference/config.html) | Every `MarkbookConfig` field |

## Packages

| Package | Purpose |
| --- | --- |
| [`@doidor/markbook`](packages/cli) | The `markbook` CLI |
| [`@doidor/markbook-core`](packages/core) | Markdown parser, builder, dev server, embed bundler, directive registry |
| [`@doidor/markbook-adapter-react`](packages/adapter-react) | Mount React stories (+ controls + decorators) |
| [`@doidor/markbook-adapter-shared`](packages/adapter-shared) | Shared browser runtime for adapters (internal; see [ADR-0026](DECISIONS.md)) |

## Repository layout

```
packages/
  core/             — markdown + builder + dev server + embed bundler + directives
  cli/              — markbook binary
  adapter-react/    — React mount + controls + decorators
  adapter-shared/   — shared pure-DOM runtime for adapters
examples/
  react-demo/       — Pixie component library — the canonical dogfood
  static-demo/      — Skyline: markdown-only docs site, no adapter
  marketing-demo/   — Cumulus: marketing site with a fully custom layout
  markbook-site/    — the official Markbook website
  embed-host/       — external consumer of the React demo's embed bundles
```

## Contributing

```bash
pnpm install        # bootstrap the workspace
pnpm build          # compile every @doidor/markbook-* package
pnpm test           # @doidor/markbook-core + CLI Vitest suites
pnpm typecheck      # tsc --noEmit across packages
pnpm lint           # biome check

pnpm examples:dev   # every example dev server in parallel
```

Conventions live in [`AGENTS.md`](AGENTS.md); architectural decisions in
[`DECISIONS.md`](DECISIONS.md); the development journal in
[`PROGRESS.md`](PROGRESS.md); planned work in [`ROADMAP.md`](ROADMAP.md).

## License

Personal project — license TBD before v1.0.

[llmstxt]: https://llmstxt.org/
