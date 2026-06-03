# `@markbook/core`

The framework-agnostic engine behind [Markbook](../../README.md): markdown
parsing, directive expansion, multi-page Vite orchestration, Pagefind
indexing, `llms.txt` emission, and the embed/package bundler.

Most users only touch `@markbook/core` through their `markbook.config.ts`.
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
} from '@markbook/core';
```

For advanced use (custom CLIs, tooling around Markbook), the internal
surface is reachable via `@markbook/core/internal` — but signatures there
may change between minor releases.

## Directives

Markdown-level container directives expand at build time. Three are
supported.

### `:::story` — single story per file

```
:::story{src=./Button.stories.tsx [export=Default] [id=stable-slug]}
:::
```

- `src` *(required)* — path to the story file, relative to the markdown page
- `export` — named export to mount (default: `default`)
- `id` — explicit embed slug for `markbook bundle`. Survives file renames

The story file's default export is the renderer (a function returning JSX, a
Vue component, or an HTML string for web components).

### `:::stories` — multi-export story file (CSF v3)

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

### `:::props` — props table

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
| `template` | `string` | Wrap content in `<templatesDir>/<name>.md` |
| `component` | `string` | Path to the component for `:::props` (relative to page) |
| `componentExport` | `string` | Named export within `component` |

## Configuration (`MarkbookConfig`)

```ts
export default defineConfig({
  // Project layout
  root: process.cwd(),               // default: cwd
  docsDir: 'docs',                   // markdown source root
  outDir: 'dist',                    // build output
  templatesDir: ['_layouts'],        // string or string[]; search order
  title: 'My Components',
  description: 'A short blurb',

  // Adapter (required)
  adapter: reactAdapter({ decorators: ['./preview.tsx'] }),

  // Dev server
  dev: { port: 5173, host: '0.0.0.0' },

  // Bundle (`markbook bundle`) options
  bundle: {
    packageScope: '@my-org',         // for --mode package outputs
    packageVersion: '0.1.0',
  },

  // Customization (three layers, escalating)
  css: ['./markbook.css'],           // inlined AFTER built-in chrome CSS
  disableBaseCss: false,             // opt out of built-in chrome entirely
  transformHtml: async (html, page) => html, // post-process per page
});
```

## Adapter contract (`MarkbookAdapter`)

Build a new adapter for any component runtime:

```ts
import type { MarkbookAdapter } from '@markbook/core';

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
- `.markbook-props`, `.markbook-required`
- `[data-markbook-story="<id>"]`, `[data-markbook-controls="<id>"]`,
  `[data-markbook-group="<id>"]`, `[data-markbook-embed="<slug>"]`,
  `[data-markbook-theme-toggle]`, `[data-markbook-tabs]`,
  `[data-pagefind-body]`

## See also

- [Repo README](../../README.md) — overview, install, hello-world
- [`DECISIONS.md`](../../DECISIONS.md) — ADRs explaining the design
- [`PROGRESS.md`](../../PROGRESS.md) — the running development journal
