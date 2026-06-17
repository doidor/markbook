# `@doidor/markbook-core`

The framework-agnostic engine behind [Markbook](../../README.md): markdown
parsing, directive expansion, multi-page Vite orchestration, Pagefind
indexing, `llms.txt` emission, and the embed/package bundler.

Most users only touch `@doidor/markbook-core` through their `markbook.config.ts`.
This README documents the public API surface — directives, frontmatter,
config, adapter contract, story-file conventions, and theme tokens.

## Public API

```ts
import {
  defineConfig,
  build,
  dev,
  bundleEmbed,
  type MarkbookConfig,
  type MarkbookAdapter,
  type BundleEmbedOptions,
  type BundleMode,
  type BundleIsolation,
} from '@doidor/markbook-core';
```

For advanced use (custom CLIs, tooling around Markbook), the internal
surface is reachable via `@doidor/markbook-core/internal` — but signatures there
may change between minor releases.

## Directives

Markdown directive blocks (`:::name{attr=value}\nbody\n:::` or `::name{attr=value}` for leaf form) expand at build time. The syntax itself is provided by [`remark-directive`](https://github.com/remarkjs/remark-directive); Markbook layers a registry + dispatcher on top.

**Three built-in directives** ship with Markbook (story / stories / props) — see below. They cannot be overridden by `config.directives`.

**Arbitrary user directives** can be registered from `markbook.config.ts`:

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

Handlers can be inline (as above), or imported from external modules (jiti loads the whole config tree transparently — TypeScript imports work through to `directives/callout.ts` etc.). For directive output that's more than a one-liner, the `htmlTemplate(new URL('./template.html', import.meta.url))` helper lets the markup live in a real `.html` file with `{{ key }}` substitution — handler imports the template, calls `render({ vars })`. Both leaf + container forms are supported. Handlers can be async; results can include `markdown` (for the `llms.txt` mirror) and `dependencies` (for dev-mode re-rendering on external-file changes). Errors are wrapped with `file:line:col` and preserve the original via `Error.cause`.

See the [custom directives guide](https://doidor.github.io/markbook/guides/custom-directives.html) for the full surface (descriptor form, type pinning, llms.txt fallback, dev-mode dependency tracking, etc.) and ADR-0025 for the design rationale.

#### Nesting directives

A container directive's body is itself parsed for directives, so leaf (and container) directives **compose**:

```md
:::section{label=Currently}
::about-item{label="Role:" text="Principal Engineer"}
::about-item{label="Team:" text="Core"}
:::
```

The `section` handler receives the rendered children — including each `about-item`'s handler output — as `innerHtml`. To nest a container inside a container, add **more colons to the outer fence** (same rule as nested code fences):

```md
::::group
:::inner
::leaf{}
:::
::::
```

> **Directives are not parsed inside raw HTML blocks.** A `::link` written between `<ul>` … `</ul>` is left as literal text — that's a CommonMark rule (the block is opaque raw HTML), not a Markbook limitation. Build the structure with a container directive instead (e.g. a `link-list` whose handler wraps `innerHtml` in `<ul>`, with `link` leaf children rendering `<li>`). Built-in directives (`story` / `stories` / `props`) only run at the top level, never nested.

### `:::story` — single story per file (built-in)

```
:::story{src=./Button.stories.tsx [export=Default] [id=stable-slug]}
:::
```

- `src` *(required)* — path to the story file, relative to the markdown page
- `export` — named export to mount (default: `default`)
- `id` — explicit embed slug for `markbook bundle`. Survives file renames

The story file's default export is the renderer (a function returning JSX, or
a React element).

### `:::stories` — multi-export story file (CSF v3) (built-in)

```
:::stories{src=./Button.stories.tsx [only=A,B] [exclude=C] [id=base-slug]}
:::
```

Fans out to one rendered story per **named** export of the file. Each export
may be a render function:

```tsx
export const Primary = () => <Button variant="primary" />;
```

…or a Storybook CSF v3 object (`render` plus at least one metadata field):

```tsx
export const Secondary = {
  name: 'Secondary action',
  args: { variant: 'secondary' },
  parameters: { layout: 'centered' },
  render: (args) => <Button {...args} />,
};
```

Filtering:

- `only=Primary,Secondary` — whitelist exports (CSV)
- `exclude=Internal` — blacklist exports (CSV)

Each export becomes its own H3 heading (humanized from the export name —
`PrimaryButton` → `Primary Button`) so the page TOC picks them up. The
"Show code" disclosure renders **once** under the group with the full
multi-export source.

Excluded names: `default`, `args`, `argTypes`, `parameters`, anything
starting with `_`, and any TypeScript type-only export.

Embed slugs for `:::stories` always promote with the export name
(`${baseSlug}-${kebab(exportName)}`) — adding/removing exports later never
silently renames an existing embed.

### `:::props` — props table (built-in)

```
---
component: ./Button.tsx
componentExport: Button   # optional, defaults to first export
---

:::props
:::
```

Renders a table of every prop in the named component, generated from its
TypeScript types via `react-docgen-typescript` (React-only).

## Frontmatter

| Field | Type | Purpose |
| --- | --- | --- |
| `title` | `string` | Page title; falls back to first H1, then the file ID |
| `description` | `string` | Used as muted lede after the H1; appears in nav descriptions |
| `order` | `number` | Sidebar position within the page's nav group (lower = earlier). Ordered pages appear before unordered ones; same-`order` pages preserve file-discovery order. The index page is always first. |
| `template` | `string` | Wrap content in `<templatesDir>/<name>.md` |
| `layout` | `string \| false` | Pick an HTML layout `<layoutsDir>/<name>.html`; `false` to opt out when `config.layout` sets a default |
| `component` | `string` | Path to the component for `:::props` (relative to page) |
| `componentExport` | `string` | Named export within `component` |

## Configuration (`MarkbookConfig`)

```ts
export default defineConfig({
  // Project layout
  root: process.cwd(),               // default: cwd
  contentDir: 'pages',               // markdown source root (default: 'docs')
                                     // `docsDir` is the legacy alias
  outDir: 'dist',                    // build output
  templatesDir: ['_layouts'],        // markdown wrappers (string or string[])
  layoutsDir: 'layouts',             // HTML shells (string or string[])
  layout: 'default',                 // default HTML layout for every page
  publicDir: 'public',               // static assets copied to dist root
                                     //   (default; set to false to disable)
  title: 'My Components',
  description: 'A short blurb',

  // SEO + Open Graph (all optional, all auto-injected into <head>)
  siteUrl: 'https://example.com',    // origin (no trailing slash); enables
                                     //   canonical, og:url, sitemap.xml, robots.txt
  themeColor: '#0a1228',             // <meta name="theme-color"> (mobile chrome)
  ogImage: 'https://example.com/og.png', // default OG/Twitter image URL

  // Adapter (optional — defaults to staticAdapter() for markdown-only sites)
  adapter: reactAdapter({ decorators: ['./preview.tsx'] }),

  // Dev server
  dev: { port: 5173, host: '0.0.0.0' },

  // Feature toggles (all default ON)
  search: true,                      // build the Pagefind search index
                                     //   (set false to skip Pagefind entirely)
  llmsButtons: true,                 // "View / Copy as Markdown" page buttons

  // Bundle (`markbook bundle`) options
  bundle: {
    packageScope: '@my-org',         // for --mode package outputs
    packageVersion: '0.1.0',
  },

  // Customization (four layers, escalating)
  css: ['./markbook.css'],           // 1. inlined AFTER built-in chrome CSS
  disableBaseCss: false,             // 2. opt out of built-in chrome entirely
  layoutsDir: 'layouts',             // 3. replace the entire HTML shell with
                                     //    your own files (see "HTML layouts")
  transformHtml: async (html, page) => html, // 4. post-process per page (escape hatch)
});
```

### Static assets (`public/`)

Files placed in `<root>/public/` (or whatever you set `publicDir` to) are
copied verbatim to the build output's root and served at `/` during
`markbook dev`. Backed by Vite's own `publicDir` so behaviour matches
what users expect from Astro / Next / Vite itself.

Typical uses:

- **Favicons** — drop `favicon.svg` (or `.ico`) and reference as
  `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` from your
  HTML layout or via `transformHtml`.
- **Open Graph images** — the OG image URL has to be absolute, so pair
  a static `public/og.png` with `config.ogImage: 'https://your.site/og.png'`.
- **`.well-known/`, `humans.txt`, ads.txt, security.txt** — any
  web-standard sibling file goes here.
- **Download bundles, PDFs, datasets** — anything Markdown shouldn't
  rewrite.

Set `publicDir: false` to disable entirely. Default: `'public'`.

### Full-text search (Pagefind)

By default Markbook builds a [Pagefind](https://pagefind.app) full-text
index over the static output (`build`) — and over the dev server's working
tree (`dev`) — and wires the search box into the chrome.

Set `search: false` to turn it off:

```ts
export default defineConfig({
  search: false, // skip Pagefind entirely
});
```

With `search: false`:

- `runPagefind()` is never called in `build` **or** `dev` — no `pagefind/`
  directory is emitted.
- The `{{ search }}` placeholder (and the built-in shell's search box)
  renders empty.
- `{{ bodyEnd }}` omits the Pagefind UI init script — but still emits the
  story entry module script when an adapter is configured.

Use this for sites that don't need search (single-page portfolios,
marketing/landing pages), or on platforms where Pagefind's native binary
can't run — notably **ARM64 Linux with a 16K memory page size** (e.g.
Raspberry Pi 5), where the bundled binary aborts with `Unsupported system
page size`. Disabling search lets `markbook build` / `markbook dev` run on
those machines.



Markbook always injects a complete SEO meta block into every page's `<head>`
(both via the built-in shell AND via the `{{ head }}` placeholder in HTML
layouts). The block contains:

- `<meta name="description">` — per-page frontmatter `description` wins,
  then `config.description`, then omitted entirely (Lighthouse prefers
  absence over an empty value).
- `<meta name="theme-color">` — from `config.themeColor` (default
  `'#0a1228'`).
- `<meta name="color-scheme" content="light dark">` — always.
- `<link rel="canonical">` — emitted when `config.siteUrl` is set.
- `<meta property="og:type|title|description|site_name|url|image">` —
  always emitted; `og:url` and `og:site_name` are conditional on
  `siteUrl` / `title`. `og:image` cascades per-page frontmatter
  `ogImage` → `config.ogImage` → omitted.
- `<meta name="twitter:card|title|description|image">` — always emitted;
  the card type bumps to `summary_large_image` when an image is set.

When `siteUrl` is set, both `markbook build` and `markbook dev` generate
`sitemap.xml` (listing every page with `<lastmod>`) and `robots.txt`
(referencing the sitemap) — in `dist/` for build, served from `/` in
dev. `index.html` collapses to its directory URL in the sitemap
for a cleaner canonical form.

Per-page frontmatter:

```yaml
---
title: My page
description: Page-specific description
ogImage: https://example.com/custom-og.png
---
```

### HTML layouts

When you outgrow the built-in shell, drop `.html` files into your
`layoutsDir` and Markbook will use them instead. Layouts own the entire
`<html>...</html>` structure; Markbook injects content + required bits
via `{{ placeholders }}`:

| Placeholder       | Substitutes |
| ----------------- | ----------- |
| `{{ content }}`   | Rendered page body (REQUIRED; exactly one per layout). Wrap it in `<article data-pagefind-body>` to enable search indexing. |
| `{{ head }}`      | Markbook-required `<head>` injections (theme boot script, Pagefind CSS, base CSS, user CSS, etc.). Keep this. |
| `{{ bodyEnd }}`   | Markbook-required body-end scripts (Pagefind UI init, story entry). Keep this. |
| `{{ search }}`    | The Pagefind search input slot (empty when search is disabled). |
| `{{ themeToggle }}` | Dark/light toggle button (works with the theme boot script in `{{ head }}`). |
| `{{ pageActions }}` | "View / Copy as Markdown" buttons (empty when `llmsButtons: false`). |
| `{{ title }}`     | Page title (HTML-escaped). |
| `{{ description }}` | Page description from frontmatter (HTML-escaped). |
| `{{ siteTitle }}` | `config.title` (HTML-escaped; empty if unset). |
| `{{ browserTitle }}` | What Markbook would put in `<title>` — handles the site-title fallback rules (HTML-escaped). |
| `{{ frontmatter.x }}` | Arbitrary frontmatter access via dot path (HTML-escaped — safe to interpolate into attributes). |

Validation:

- Unknown placeholders throw (typo guard).
- Missing `{{ content }}` throws.
- More than one `{{ content }}` throws.
- A named layout that doesn't exist throws (no silent fallback).
- Placeholders inside HTML comments are preserved verbatim and never substituted.

Pick a layout per-page via frontmatter (`layout: landing`) or for every
page via `config.layout`. Set `layout: false` in frontmatter to opt back
into the built-in shell when `config.layout` provides a default.

See `examples/marketing-demo/` for a worked example.

## Adapter contract (`MarkbookAdapter`)

Build a new adapter for any component runtime:

```ts
import type { MarkbookAdapter } from '@doidor/markbook-core';

export function myAdapter(): MarkbookAdapter {
  return {
    packageName: '@my-org/markbook-adapter-svelte',
    vitePlugins: () => [/* … */],
    decoratorModules: [],            // array of paths to wrapper modules
    packagePeerDeps: ['svelte'],     // externals for --mode package
    hasControls: false,              // expose setupControls()?
  };
}
```

The adapter's **default browser entry** must export `mount(el, story, opts)`
(and, if `hasControls`, `setupControls(controlsEl, args, argTypes, onChange)`).
The **config entry** (`@my-org/markbook-adapter-svelte/config`) exports the
factory above. See [ADR-0005](../../DECISIONS.md) for why this split exists.

## Story-file conventions

Stories live in `.tsx` / `.ts` / `.jsx` / `.js` files alongside the
markdown that references them. A story file may export:

| Export | Purpose |
| --- | --- |
| `default` | The renderer (single-story file) |
| Named exports (PascalCase) | Stories for `:::stories` fan-out |
| `args` | Initial prop values |
| `argTypes` | Control metadata (`{ control: 'text' \| 'number' \| 'boolean' \| 'select', options? }`) |
| `parameters` | Display options (`{ layout?, background? }`) |

`args`/`argTypes`/`parameters` are read from the named export itself if it's
a CSF v3 object; otherwise they fall back to module-level exports.

## Theme tokens (`--mb-*`)

The built-in chrome styles everything through CSS custom properties. Override
them in your `css` file to rebrand without touching templates.

| Token | Purpose |
| --- | --- |
| `--mb-bg` | Page background |
| `--mb-fg` | Foreground text |
| `--mb-fg-muted` | Muted text |
| `--mb-border` | Borders |
| `--mb-bg-elev` | Elevated surfaces (form widgets) |
| `--mb-bg-soft` | Soft surfaces (story preview, code blocks) |
| `--mb-accent` | Brand accent (active nav, highlight) |
| `--mb-accent-fg` | Text color on top of accent |
| `--mb-link` | Link color |
| `--mb-code-bg` | Inline code background |
| `--mb-radius` | Card radius |
| `--mb-font-sans` / `--mb-font-mono` | Type families |
| `--mb-content-width` | Main column max width |
| `--mb-sidebar-width` | Left nav width |
| `--mb-toc-width` | Right TOC width |
| `--mb-header-height` | Top header height |

A `[data-theme="dark"]` block re-declares the colour tokens for dark mode;
the `<html data-theme>` toggle is wired by an inline boot script.

## DOM contract for `disableBaseCss`

These classes / data-attributes stay stable even when you drop `BASE_CSS`:

- `.markbook-shell`, `.markbook-header`, `.markbook-brand`, `.markbook-sidebar`,
  `.markbook-content`, `.markbook-toc`, `.markbook-nav-group`
- `.markbook-story-block`, `.markbook-story`, `.markbook-controls`,
  `.markbook-code`, `.markbook-code-tabs`, `.markbook-code-tablist`,
  `.markbook-code-file`, `.markbook-code-file-label`
- `.markbook-code-pre-wrap`, `.markbook-fenced-code`, `.markbook-code-copy`,
  `.markbook-copy-label` (fenced markdown code blocks get the wrap +
  Shiki + copy button — see "Code blocks" below)
- `.markbook-props`, `.markbook-required`
- `[data-markbook-story="<id>"]`, `[data-markbook-controls="<id>"]`,
  `[data-markbook-group="<id>"]`, `[data-markbook-embed="<slug>"]`,
  `[data-markbook-theme-toggle]`, `[data-markbook-tabs]`,
  `[data-markbook-copy]`, `[data-pagefind-body]`

## Code blocks

Every fenced markdown code block (triple-backtick) is automatically:

- **Wrapped** in `<div class="markbook-code-pre-wrap markbook-fenced-code">`
- **Syntax-highlighted** via [Shiki](https://shiki.style/) using the
  `github-light` + `github-dark` themes (`defaultColor: false`) so the
  `<html data-theme>` swap re-paints colors with zero rebuild. Blocks
  without a language tag, or with a language Shiki doesn't recognize,
  render as plain `<pre><code>` inside the same wrapper.
- **Decorated** with a hover-revealed `<button data-markbook-copy>`. The
  copy boot script in `BASE_CSS` finds the closest wrap, reads the
  `<pre>`'s `textContent`, and writes it to the clipboard.

Story code disclosures (`:::story` expansions) use the same Shiki + copy
machinery but live inside a `<details class="markbook-code">` outer
container so they can be collapsed/expanded.

The fenced-code background pulls from `--mb-code-bg` so a single token
override re-skins every code block in light + dark mode without touching
Shiki's syntax colors.

## See also

- [Repo README](../../README.md) — overview, install, hello-world
- [`DECISIONS.md`](../../DECISIONS.md) — ADRs explaining the design
- [`PROGRESS.md`](../../PROGRESS.md) — the running development journal
