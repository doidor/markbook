---
title: Search and SEO
description: Pagefind, canonical URLs, Open Graph, Twitter Cards, sitemap.xml, robots.txt, llms.txt — all built in.
---

# Search and SEO

Markbook ships search and a complete SEO meta block by default. The only thing you configure is your site's URL.

## Full-text search (Pagefind)

[Pagefind](https://pagefind.app/) is wired in automatically. Both `markbook build` and `markbook dev` invoke it after writing your pages:

```
dist/
├── pagefind/
│   ├── pagefind-entry.json       ← manifest
│   ├── pagefind-ui.js + .css     ← the search widget
│   ├── index/<hash>.pf_index     ← the searchable index
│   ├── fragment/<hash>.pf_fragment  ← content snippets returned in results
│   └── wasm.en.pagefind          ← per-language WASM
```

### Where the search input appears

The built-in shell drops it into the header automatically. In a custom HTML layout, place the `{{ search }}` placeholder where you want it:

```html
<nav class="topnav">
  <a href="/">Brand</a>
  {{ search }}
</nav>
```

`{{ search }}` expands to `<div id="markbook-search-ui">` which Pagefind UI mounts into.

### What gets indexed

Pagefind walks every `.html` file in the output directory and indexes the text inside elements marked `data-pagefind-body`. The built-in shell puts that attribute on the `<article>` wrapper automatically. In a custom layout, you write it yourself:

```html
<article data-pagefind-body>
  {{ content }}
</article>
```

### Keeping noise out of results

Elements marked `data-pagefind-ignore="all"` are excluded from both the index AND the displayed excerpts. Markbook applies it automatically to:

- The `#` permalink anchors appended to every H2/H3 (so search snippets don't read `Containers#`).
- The "View / Copy as Markdown" button row.

If your own content has elements you don't want indexed (nav widgets, ads, footer links), add `data-pagefind-ignore="all"` to them. The literal string `"all"` is required — an empty value is silently treated as unset.

### Styling

Pagefind UI reads `--pagefind-ui-*` CSS variables. Markbook's `BASE_CSS` sets them to brand tokens; if you've disabled base CSS, set them yourself:

```css
:root {
  --pagefind-ui-primary: var(--my-accent);
  --pagefind-ui-text: var(--my-fg);
  --pagefind-ui-background: var(--my-bg);
  --pagefind-ui-border-radius: 12px;
}
```

For deeper changes, override `.pagefind-ui__*` classes directly.

### Keyboard shortcuts

Cmd/Ctrl+K and `/` both focus the search input (when not already typing into another input). Wired up via a small boot script Markbook always inlines.

### Disabling search

Set `search: false` in `markbook.config.ts` to skip Pagefind entirely:

```ts
export default defineConfig({
  search: false,
});
```

With it off, neither `markbook build` nor `markbook dev` invokes Pagefind, so no `pagefind/` directory is written, `{{ search }}` renders empty, and the Pagefind UI script is omitted from `{{ bodyEnd }}` (the story entry script still loads). Reach for this on single-page or marketing sites that don't need search — or on platforms where Pagefind's native binary can't run, notably **ARM64 Linux with a 16K memory page size** (e.g. Raspberry Pi 5), where it aborts with `Unsupported system page size`.

## SEO meta block

For every page, Markbook injects a complete SEO block into `<head>` — both via the built-in shell AND via the `{{ head }}` placeholder in custom layouts. Per-page values cascade: frontmatter > config defaults.

| Tag | Source | When emitted |
| --- | --- | --- |
| `<meta name="description">` | frontmatter `description` → `config.description` | When non-empty (skipped to avoid Lighthouse warning) |
| `<meta name="theme-color">` | `config.themeColor` (default `#0a1228`) | Always |
| `<meta name="color-scheme" content="light dark">` | constant | Always |
| `<link rel="canonical">` | `${siteUrl}/${page.htmlRelPath}` | Only when `siteUrl` is set |
| `<meta property="og:type|title|description|site_name|url|image">` | Cascade from config + frontmatter | Always (some fields conditional) |
| `<meta name="twitter:card|title|description|image">` | Mirror of OG | Always; card type bumps to `summary_large_image` when image set |

### Configure once

```ts
export default defineConfig({
  title: 'My Site',
  description: 'A short blurb. Used as default for og:description.',
  siteUrl: 'https://my-site.com',      // strict validation; no trailing slash
  themeColor: '#7c3aed',
  ogImage: 'https://my-site.com/og.png',  // absolute URL (not prepended with siteUrl)
});
```

### Per-page overrides

```yaml
---
title: Pricing
description: Plans that scale with your team.
ogImage: https://my-site.com/og/pricing.png
---
```

## `sitemap.xml` + `robots.txt`

Auto-generated whenever `siteUrl` is set. Emitted by both `markbook build` (to `dist/`) and `markbook dev` (to the in-memory build dir, served from `/`).

**`sitemap.xml`** — every page with `<lastmod>`. `index.html` collapses to its directory URL for cleaner canonical form:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://my-site.com/</loc>
    <lastmod>2026-06-04</lastmod>
  </url>
  <url>
    <loc>https://my-site.com/pricing.html</loc>
    <lastmod>2026-06-04</lastmod>
  </url>
</urlset>
```

**`robots.txt`** — references the sitemap:

```
User-agent: *
Allow: /

Sitemap: https://my-site.com/sitemap.xml
```

When `siteUrl` is unset, neither file is emitted (the sitemap spec requires absolute URLs — no point shipping a stub).

## `llms.txt` for AI consumption

Markbook also emits an `llms.txt` index following the [llmstxt.org](https://llmstxt.org/) spec, plus per-page plain-markdown mirrors at `/llms/<page>.txt`. AI assistants can fetch these to get clean text without HTML noise.

Both the built-in shell and the marketing demo's footer link to `/llms.txt`. Per-page "View as Markdown" / "Copy as Markdown" buttons appear above each article by default; set `llmsButtons: false` in config to suppress them.

Each `.txt` file:

- Starts with a UTF-8 BOM (`EF BB BF`) so browsers detect the encoding regardless of host `Content-Type` headers.
- Is served with `Content-Type: text/plain; charset=utf-8` by `markbook dev` and `markbook preview`.

## Next steps

- [Config reference →](../reference/config.html) — `siteUrl`, `themeColor`, `ogImage`, `llmsButtons`.
- [Customization →](./customization.html) — restyle search to fit your brand.
- [CLI reference →](../reference/cli.html) — when to use `dev` vs `preview`.
