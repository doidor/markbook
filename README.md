# Markbook

**A lightweight, markdown-first Storybook alternative.** Author your
documentation as plain **Markdown**; reference component stories that live in
adjacent `.tsx` / `.ts` / `.jsx` / `.js` files via directives. The build emits
a static, Starlight-style HTML site with full-text search, dark mode, an
[`llms.txt`][llmstxt] mirror, SEO tags, and a sitemap — plus portable, drop-in
embeds of any of your stories.

📖 **[Read the docs →](https://doidor.github.io/markbook)** &nbsp;·&nbsp;
🧩 React stories (Vue + Web Components planned) &nbsp;·&nbsp;
🔍 Pagefind search &nbsp;·&nbsp;
📦 Portable story embeds

> **Status:** pre-1.0. **Only the React adapter ships today** — Vue and Web
> Components adapters are on the [roadmap](ROADMAP.md). The public API
> (`defineConfig`, `build`/`dev`/`bundle`, the adapter contract, directives,
> frontmatter, theme tokens) is documented and largely stable, but minor
> releases may still break things until v1.0 freezes it.

---

## Contents

- [Why Markbook](#why-markbook)
- [Install](#install)
- [Quick start](#quick-start)
- [Core concepts](#core-concepts)
  - [Pages & frontmatter](#pages--frontmatter)
  - [Directives](#directives)
  - [Component stories](#component-stories)
  - [Bundling stories](#bundling-stories)
  - [Customization](#customization)
  - [Search, SEO & llms.txt](#search-seo--llmstxt)
- [CLI](#cli)
- [Configuration](#configuration)
- [What Markbook deliberately doesn't ship](#what-markbook-deliberately-doesnt-ship)
- [Packages](#packages)
- [Repository layout](#repository-layout)
- [Contributing](#contributing)
- [License](#license)

---

## Why Markbook

- **🤖 Agent-first by default.** Markbook ships six built-in
  [agent skills](https://doidor.github.io/markbook/guides/agent-skills.html) —
  `markbook-init`, `markbook-add-component-page`, `markbook-bulk-generate`,
  `markbook-style`, `markbook-layout`, `markbook-bundle-story` — installable into
  Claude Code, Codex, OpenCode, Cursor, or any agent CLI that auto-discovers
  skills. One `npx markbook skills install` and your agent already knows the
  conventions: setting up docs is a one-line conversation, not a config safari.
- **📄 Markdown is the source of truth.** Every page is a `.md` file; the HTML
  site and the `llms.txt` mirror are two views of one AST. No MDX, no JSX in
  your prose, no JSON sidecars, no JS templates to learn.
- **🧩 Component stories, optional.** Drop a `:::story` directive into any page
  to mount a React component example. Skip the directive — and the
  adapter — for a pure docs/marketing site. (Vue and Web Components adapters are
  [planned](ROADMAP.md); React is the only one implemented today.)
- **🔍 Search + SEO by default.** [Pagefind][pagefind] builds a full-text index
  at build time. Canonical, Open Graph, Twitter Card, `sitemap.xml`, and
  `robots.txt` are emitted automatically.
- **🎨 Four layers of customization.** Token overrides → opt out of base CSS →
  swap the HTML shell with your own layouts → post-process the final HTML. Each
  layer is opt-in; reach for the smallest one that solves your problem.
- **📦 Portable stories.** `markbook bundle` produces self-contained ESM embeds
  (drop a `<script type="module">` on any page) or publishable npm packages
  with the framework as a peer dependency — stories that work anywhere.
- **⚡ Fast dev loop.** Vite under the hood. ~80 ms regeneration on a small site,
  including a full Pagefind re-index, with hot reload across markdown, CSS,
  layouts, and story files.
- **🛠️ Extensible directives.** Beyond the three built-ins, register your own
  `:::name` handlers from `markbook.config.ts` — admonitions, video embeds,
  diagram renderers, any reusable markdown vocabulary your team needs.

## Install

> **Agent-first by default — try the skills before you write any config.**
> Install the CLI, then run `npx markbook skills install` to drop six
> procedural skills (`markbook-init`, `markbook-add-component-page`,
> `markbook-bulk-generate`, `markbook-style`, `markbook-layout`,
> `markbook-bundle-story`) into `.claude/` / `.codex/` / `.opencode/` /
> `.agents/`. Then ask your agent _"Set up Markbook in this project"_ and it
> knows what to do. Full per-skill walkthrough in the
> [agent skills guide](https://doidor.github.io/markbook/guides/agent-skills.html);
> deep-dive flags in the
> [skills reference](https://doidor.github.io/markbook/reference/skills.html).

```bash
# Core + CLI (markdown-only sites need nothing else)
npm install -D @doidor/markbook @doidor/markbook-core
pnpm add -D @doidor/markbook @doidor/markbook-core
yarn add -D @doidor/markbook @doidor/markbook-core
```

For live **component stories**, add the React adapter and its runtime:

```bash
# React — adapter (dev) + react/react-dom runtime
npm install -D @doidor/markbook-adapter-react && npm install react react-dom
pnpm add -D @doidor/markbook-adapter-react && pnpm add react react-dom
yarn add -D @doidor/markbook-adapter-react && yarn add react react-dom
```

> **React is the only adapter implemented today.** Vue and Web Components
> adapters are on the [roadmap](ROADMAP.md) but not yet available.

Each block lists the npm / pnpm / yarn form of the same command — use whichever
package manager your project uses.

## Quick start

A minimal markdown-only site:

```
my-site/
├─ pages/
│  └─ index.md
└─ markbook.config.ts
```

`markbook.config.ts`:

```ts
import { defineConfig } from '@doidor/markbook-core';

export default defineConfig({
  title: 'My Project',
  description: 'A short blurb about the site.',
});
```

`pages/index.md`:

```markdown
---
title: Welcome
description: The home page of my site.
---

# Hello, world

This is **markdown**. It becomes HTML — with search, dark mode, and a TOC.
```

Then:

```bash
npx markbook dev      # live dev server with HMR  → http://localhost:5173
npx markbook build    # static site in dist/
npx markbook preview  # serve dist/ over HTTP      → http://localhost:4173
```

> Markbook reads from `pages/` or `docs/` (configurable via `contentDir`).
> Don't open `dist/*.html` via `file://` — Pagefind loads its runtime through
> dynamic `import()`, which browsers block on `file://`. Use `markbook preview`.

### …with a component story

Add an adapter to the config and reference a story file from markdown:

```ts
// markbook.config.ts
import { defineConfig } from '@doidor/markbook-core';
import { reactAdapter } from '@doidor/markbook-adapter-react/config';

export default defineConfig({
  title: 'My Components',
  adapter: reactAdapter(),
});
```

```tsx
// pages/Button/Button.stories.tsx
import { Button } from '../../../src/Button';
export default () => <Button variant="primary">Click me</Button>;
```

````markdown
<!-- pages/index.md -->
# Button

:::story{src=./Button/Button.stories.tsx}
:::
````

Markbook mounts the live component where the directive was, with a
Shiki-highlighted "Show code" disclosure underneath.

## Core concepts

### Pages & frontmatter

Each `.md` file under `contentDir` becomes a page. Subdirectories become
sidebar nav groups; H2/H3 headings become the on-this-page TOC. Frontmatter
controls per-page behavior:

| Field | Type | Purpose |
| --- | --- | --- |
| `title` | `string` | Page title (falls back to the first H1, then the file id). |
| `description` | `string` | Muted lede under the H1; used for `<meta name="description">`. |
| `order` | `number` | Sidebar position within the nav group (lower = earlier). |
| `template` | `string` | Wrap the page in a markdown template from `templatesDir`. |
| `layout` | `string \| false` | Pick an HTML layout from `layoutsDir`, or `false` to force the built-in shell. |
| `component` / `componentExport` | `string` | Target component for `:::props`. |
| `ogImage` | `string` | Per-page Open Graph image (overrides `config.ogImage`). |

### Directives

Markbook recognizes `:::name{attr=value}` (container) and `::name{attr=value}`
(leaf) blocks on top of standard markdown — the syntax comes from
[`remark-directive`](https://github.com/remarkjs/remark-directive); Markbook
layers a registry + dispatcher on top.

**Three built-ins** (tightly integrated with internal pipelines; cannot be
overridden):

- **`:::story{src=… [export=…] [id=…]}`** — mount a single story (the file's
  default export, or a named `export`).
- **`:::stories{src=… [only=A,B] [exclude=C]}`** — mount every named runtime
  export of a CSF-v3 story file, discovered via TypeScript AST analysis, one
  card per export.
- **`:::props`** — render a props table for a React component (frontmatter
  `component:`), generated from its TypeScript types via
  `react-docgen-typescript`. The table is mirrored into `llms.txt` too.

**User directives** — register your own from `markbook.config.ts`:

```ts
import { defineConfig, escapeAttribute } from '@doidor/markbook-core';

export default defineConfig({
  directives: {
    youtube: ({ attributes }) =>
      `<iframe src="https://youtube.com/embed/${escapeAttribute(attributes.id ?? '')}" allowfullscreen></iframe>`,

    callout: ({ attributes, innerHtml }) =>
      `<aside class="callout callout-${attributes.type ?? 'info'}">${innerHtml ?? ''}</aside>`,
  },
});
```

Handlers can be async, read files (with dev-mode dependency tracking), return a
plain-markdown fallback for `llms.txt`, and live in their own modules. The
`htmlTemplate(new URL('./callout.html', import.meta.url))` helper lets directive
markup live in a real `.html` file with `{{ key }}` substitution instead of
inline template literals. See the
[custom directives guide](https://doidor.github.io/markbook/guides/custom-directives.html).

### Component stories

The React adapter mounts stories into placeholder elements; the core engine
knows nothing about any framework, so more adapters can be added without
touching it.

| Adapter | Mounts | Runtime |
| --- | --- | --- |
| `@doidor/markbook-adapter-react` | React components | `react`, `react-dom` (peer) |

> Vue and Web Components adapters are [planned](ROADMAP.md) but not yet
> implemented — React is the only adapter available today.

A story file is a regular component file. **One story per file** is the
convention (default export); multiple named exports fan out via `:::stories`.
Storybook **CSF v3** object exports are supported:

```tsx
export const Primary = {
  render: (args) => <Button {...args}>Click me</Button>,
  args: { variant: 'primary', disabled: false },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary'] },
    disabled: { control: 'boolean' },
  },
  parameters: { layout: 'centered' }, // centered | padded | fullscreen
};
```

- **`args`** — initial prop values. The React adapter renders an interactive
  **controls panel** under the story so readers can tweak props live.
- **`argTypes`** — control hints (`text` / `number` / `boolean` / `select`);
  inferred from `args` when omitted.
- **Decorators** — wrap every story in shared providers (theme, i18n, router)
  via `reactAdapter({ decorators: ['./preview.tsx', './theme.tsx'] })`. Applied
  outer-to-inner: `['A', 'B']` → `<A><B><Story/></B></A>`.

See the [adding-stories guide](https://doidor.github.io/markbook/guides/adding-stories.html).

### Bundling stories

`markbook bundle` packages stories as portable artifacts that work outside the
docs site:

```bash
markbook bundle                      # all stories → self-mounting ESM embeds
markbook bundle my-button            # one story by id
markbook bundle --mode package       # publishable npm package directories
markbook bundle --isolation shadow   # wrap each mount in an open shadow root
```

- **`embed` mode** → `dist/embed/<slug>.js`. Drop a placeholder anywhere:
  ```html
  <div data-markbook-embed="my-button"></div>
  <script type="module" src="https://cdn.example.com/embed/my-button.js"></script>
  ```
  The bundled CSS is baked in and injected at mount time (into `document.head`,
  or the shadow root with `--isolation shadow` so host-page CSS can't leak in).
- **`package` mode** → `dist/packages/<slug>/`, a publishable npm package with
  the framework declared as a peer dependency.

### Customization

Four escalating layers — use the smallest that solves your problem:

1. **`css`** — inline CSS files after the built-in chrome. Override the `--mb-*`
   theme tokens (`--mb-bg`, `--mb-fg`, `--mb-accent`, `--mb-content-width`, …) to
   rebrand without touching templates. A `[data-theme="dark"]` block re-declares
   the color tokens; the toggle is wired by an inline boot script.
2. **`disableBaseCss`** — drop the built-in stylesheet entirely. The
   `.markbook-*` class names and `data-*` hooks stay stable so you can restyle
   from scratch.
3. **`layoutsDir` + `layout`** — replace the whole HTML shell with your own
   `.html` layouts, using `{{ content }}`, `{{ head }}`, `{{ bodyEnd }}`,
   `{{ search }}`, `{{ themeToggle }}`, `{{ pageActions }}`, `{{ title }}`,
   `{{ frontmatter.x }}`, … placeholders (validated — unknown placeholders and a
   missing/duplicate `{{ content }}` throw).
4. **`transformHtml(html, page)`** — an async escape hatch that post-processes
   each page's final HTML.

### Search, SEO & llms.txt

- **Search** — Pagefind indexes the built output (and the dev server). `Cmd/Ctrl+K`
  or `/` focuses the search box.
- **SEO** — set `siteUrl` to emit `<link rel="canonical">`, `og:url`,
  `sitemap.xml`, and `robots.txt`. Open Graph + Twitter Card + `theme-color` +
  `color-scheme` meta are always injected.
- **llms.txt** — every build emits a top-level `/llms.txt` index plus per-page
  plain-markdown mirrors at `/llms/<page>.txt`, surfaced via "View / Copy as
  Markdown" buttons on each page.

## CLI

```bash
npx markbook <command> [options]
```

| Command | Purpose |
| --- | --- |
| `build` | Build the static site to `outDir` (parse → layout → Vite bundle → llms.txt → sitemap → Pagefind). |
| `dev` | Vite dev server with HMR across markdown, CSS, layouts, and story files. `--port`, `--host`. |
| `preview` | Serve the built `dist/` over HTTP (verify production output). |
| `bundle [storyId]` | Bundle one/all stories. `--mode embed\|package`, `--isolation shadow`. |
| `skills install` / `skills list` | Manage the agent skills shipped in the npm package. |

Common flags: `-c, --config <path>` and `--root <path>`. Full details in the
[CLI reference](https://doidor.github.io/markbook/reference/cli.html).

## Configuration

`markbook.config.{ts,mts,js,mjs}` exports a `MarkbookConfig` via `defineConfig`:

```ts
import { defineConfig } from '@doidor/markbook-core';
import { reactAdapter } from '@doidor/markbook-adapter-react/config';

export default defineConfig({
  // Layout
  contentDir: 'pages',          // default 'docs'
  outDir: 'dist',
  publicDir: 'public',          // static assets copied to the output root

  // Identity + SEO
  title: 'My Component Library',
  description: 'A small set of accessible primitives.',
  siteUrl: 'https://my-components.example',  // enables canonical/OG/sitemap
  themeColor: '#7c3aed',
  ogImage: 'https://my-components.example/og.png',

  // Customization
  css: ['./brand.css'],
  // disableBaseCss: true,
  // layoutsDir: 'layouts', layout: 'default',
  // transformHtml: async (html, page) => html,

  // Component stories (omit for markdown-only sites)
  adapter: reactAdapter({ decorators: ['./preview.tsx'] }),

  // User directives
  directives: { /* youtube, callout, … */ },

  // Optional: "Open in playground" buttons (CodeSandbox / StackBlitz)
  // playground: { providers: ['codesandbox', 'stackblitz'] },

  dev: { port: 5173 },
});
```

Every field, with defaults, lives in the
[config reference](https://doidor.github.io/markbook/reference/config.html) and
in [`packages/core/README.md`](packages/core/README.md).

## What Markbook deliberately doesn't ship

- **No MDX.** Markdown is markdown. To embed a component, use a story directive —
  your component file stays a regular `.tsx` your tooling already understands.
- **No theme engine.** Customize via CSS tokens or replace the shell. No
  theme-prop API, no provider hierarchy, no plugin framework to learn.
- **No bundled UI framework.** Markbook itself is plain HTML + minified IIFE
  boot scripts. Bring React for stories if you want them; the engine
  doesn't care.

## Packages

| Package | Purpose |
| --- | --- |
| [`markbook`](packages/cli) | The `markbook` CLI (`build`, `dev`, `preview`, `bundle`, `skills`). |
| [`@doidor/markbook-core`](packages/core) | Markdown parser, builder, dev server, embed bundler, directive registry. |
| [`@doidor/markbook-adapter-react`](packages/adapter-react) | Mount React stories (+ controls + decorators). |
| [`@doidor/markbook-adapter-shared`](packages/adapter-shared) | Shared browser runtime for adapters (internal; see [ADR-0026](DECISIONS.md)). |

> Vue and Web Components adapters are [planned](ROADMAP.md), not yet shipped.

## Repository layout

```
packages/
  core/             — markdown + builder + dev server + embed bundler + directives
  cli/              — `markbook` binary (cac + jiti)
  adapter-react/    — React mount + controls + decorators
  adapter-shared/   — shared pure-DOM runtime for adapters
examples/
  react-demo/       — Pixie component library — the canonical dogfood
  static-demo/      — Skyline: a markdown-only docs site, no adapter
  marketing-demo/   — Cumulus: a marketing site with a fully custom layout
  markbook-site/    — the official Markbook website (hybrid layout, custom :::callout)
  embed-host/       — external consumer of the React demo's embed bundles
```

## Contributing

```bash
pnpm install      # bootstrap the workspace
pnpm build        # compile every @doidor/markbook-* package (tsc -b, topological)
pnpm test         # @doidor/markbook-core + CLI Vitest suites
pnpm typecheck    # tsc --noEmit across packages (resolves from source — no prior build needed)
pnpm lint         # biome check

pnpm examples:dev     # every example dev server in parallel (ports 5173+)
pnpm examples:build   # build every example
```

Conventions live in [`AGENTS.md`](AGENTS.md); architectural decisions in
[`DECISIONS.md`](DECISIONS.md); the running development journal in
[`PROGRESS.md`](PROGRESS.md); planned work in [`ROADMAP.md`](ROADMAP.md).

## License

Personal project — license TBD before v1.0.

[pagefind]: https://pagefind.app/
[llmstxt]: https://llmstxt.org/
