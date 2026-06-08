---
title: Configuration reference
description: Every field of MarkbookConfig, with defaults and examples.
---

# Configuration reference

`markbook.config.{ts,mts,js,mjs}` lives at your project root and exports a `MarkbookConfig` object via `defineConfig` (for type inference).

```ts
import { defineConfig } from '@doidor/markbook-core';

export default defineConfig({
  // ...
});
```

## Project layout

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `root` | `string` | `process.cwd()` | Project root. Everything else is resolved against this. |
| `contentDir` | `string` | `'docs'` | Where markdown pages live. `docsDir` is the legacy alias — setting both throws. |
| `outDir` | `string` | `'dist'` | Production build output. |
| `templatesDir` | `string \| string[]` | `'templates'` | Markdown template files for the frontmatter `template:` field. |
| `layoutsDir` | `string \| string[]` | `'layouts'` | HTML layout files. See [customization →](../guides/customization.html). |
| `layout` | `string` | (unset) | Default HTML layout name applied to every page (frontmatter overrides). |
| `publicDir` | `string \| false` | `'public'` | Static assets copied to the output root. `false` to disable. |

## Site identity

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `title` | `string` | (unset) | Site-wide title. When unset, per-page frontmatter title flows into the header brand AND browser tab. |
| `description` | `string` | (unset) | Site-wide description; falls back as `<meta name="description">` when a page omits its own. |
| `siteUrl` | `string` | (unset) | Canonical origin (no trailing slash). Enables `<link rel="canonical">`, `og:url`, sitemap.xml, robots.txt. |
| `themeColor` | `string` | `'#0a1228'` | `<meta name="theme-color">` (mobile browser chrome). |
| `ogImage` | `string` | (unset) | Default Open Graph / Twitter image URL (absolute). Per-page `ogImage` frontmatter overrides. |

## Customization

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `css` | `string \| string[]` | (none) | CSS files inlined into every page after `BASE_CSS`. Use for `--mb-*` token overrides. |
| `disableBaseCss` | `boolean` | `false` | Skip Markbook's built-in chrome stylesheet entirely. Pair with `layoutsDir` to own the entire shell. |
| `transformHtml` | `(html, page) => string \| Promise<string>` | (none) | Post-process every page's final HTML. Runs LAST — after layout substitution. |

## Adapter (component stories)

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `adapter` | `MarkbookAdapter` | `staticAdapter()` | Framework adapter for `:::story` directives. Provided by `@doidor/markbook-adapter-react` (Vue + Web Components adapters are planned). Omit for markdown-only sites. |

The default `staticAdapter` errors clearly if any page tries to use a story directive without an explicit adapter.

## Search and llms.txt

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `llmsButtons` | `boolean` | `true` | "View as Markdown" / "Copy as Markdown" buttons above each article. |

Search (Pagefind) is always on; turn it off in a custom layout by not including `{{ search }}` and `{{ bodyEnd }}`.

## Dev server

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `dev.port` | `number` | `5173` (Vite default) | Port for `markbook dev`. `markbook preview` uses `port + 1000` by default to avoid clashes. |
| `dev.host` | `string` | (Vite default) | Host to bind. |

## Bundle (`markbook bundle`)

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `bundle.packageScope` | `string` | (unset) | npm scope for `--mode package` outputs (e.g. `'@my-org'`). |
| `bundle.packageVersion` | `string` | `'0.0.1'` | Version written into generated `package.json` files. |

## Playground integration

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `playground` | `PlaygroundConfig \| false` | (none) | "Open in playground" buttons per story (CodeSandbox / StackBlitz). |
| `playground.providers` | `'codesandbox' \| 'stackblitz' \| Array` | required | Which providers to render buttons for. |
| `playground.dependencies` | `Record<string, string>` | React defaults | npm deps written to the sandbox `package.json`. |
| `playground.stackblitzTemplate` | `string` | `'create-react-app'` | StackBlitz starter template. |
| `playground.inlineSourceImports` | `string[]` | (none) | Globs of in-repo source files to inline into the sandbox so monorepo imports resolve. |

## Full example

```ts
import { defineConfig } from '@doidor/markbook-core';
import { reactAdapter } from '@doidor/markbook-adapter-react/config';

export default defineConfig({
  // Layout
  contentDir: 'pages',
  outDir: 'dist',
  publicDir: 'public',

  // Identity
  title: 'My Component Library',
  description: 'A small set of accessible React primitives.',
  siteUrl: 'https://my-components.example',
  themeColor: '#7c3aed',
  ogImage: 'https://my-components.example/og.png',

  // Customization
  css: ['./brand.css'],

  // React stories
  adapter: reactAdapter({
    decorators: ['./preview.tsx'],
  }),

  // Playground
  playground: {
    providers: ['codesandbox', 'stackblitz'],
    dependencies: {
      react: 'latest',
      'react-dom': 'latest',
      '@my-org/components': '^1.0.0',
    },
    inlineSourceImports: ['src/**/*.{ts,tsx}'],
  },

  // Dev
  dev: { port: 5173 },
});
```
