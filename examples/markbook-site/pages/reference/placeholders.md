---
title: Layout placeholders
description: Every {{ }} placeholder Markbook recognizes in HTML layouts.
---

# Layout placeholders

HTML layouts in `layoutsDir/<name>.html` are HTML with `{{ key }}` substitutions. Markbook recognizes a fixed set of tokens (typo guard — unknown tokens throw at build).

## Required

| Token | Substitutes | Notes |
| --- | --- | --- |
| `{{ content }}` | Rendered page body (inner HTML, no article wrapper) | **Exactly one per layout** — zero or more throws. Wrap it yourself in `<article data-pagefind-body>` to enable search indexing. |

## Markbook-required injections

These carry framework requirements (scripts, CSS, runtime). Omitting them silently breaks features.

| Token | Substitutes | Omit at your peril |
| --- | --- | --- |
| `{{ head }}` | Theme boot script, tabs / playground / copy / permalink / search-kbd / copy-md boot scripts, Pagefind CSS link, BASE_CSS (unless `disableBaseCss`), user CSS, complete SEO meta block | Theme switching, search, copy-code, permalinks, page-level CSS — all break without it. |
| `{{ bodyEnd }}` | Pagefind UI script + init, story entry module script | Search initialization + story mounting break without it. |

## Optional UI hooks

Drop these where you want the corresponding UI element.

| Token | Substitutes | When empty |
| --- | --- | --- |
| `{{ search }}` | `<div id="markbook-search-ui">` — Pagefind UI mounts into it | Empty when `search: false` in config (Pagefind skipped). Populated otherwise. |
| `{{ themeToggle }}` | Dark/light toggle button | Always rendered. |
| `{{ pageActions }}` | "View / Copy as Markdown" buttons | Empty when `llmsButtons: false`. |

## Per-page text

HTML-escaped — safe to interpolate into attributes.

| Token | Source |
| --- | --- |
| `{{ title }}` | Page title (frontmatter `title` → first H1 → file ID) |
| `{{ description }}` | Effective description (frontmatter `description` → `config.description` → empty) |
| `{{ siteTitle }}` | `config.title` (empty if unset) |
| `{{ browserTitle }}` | Effective `<title>` value — `${pageTitle} — ${siteTitle}` when both set, else just one |

## Arbitrary frontmatter

| Token | Substitutes |
| --- | --- |
| `{{ frontmatter.<dot.path> }}` | Any frontmatter field via dot-path (HTML-escaped). Missing paths render as empty string. |

```yaml
---
author:
  name: Tudor
  url: https://example.com
---
```

```html
{{ frontmatter.author.name }}        ← "Tudor"
{{ frontmatter.author.url }}         ← "https://example.com"
{{ frontmatter.author }}             ← JSON-stringified object
{{ frontmatter.missing }}            ← ""
```

## Validation rules

All throw at build time:

- **Missing `{{ content }}`** — `HTML layout 'X' is missing a {{ content }} placeholder.`
- **Duplicate `{{ content }}`** — `HTML layout 'X' has N {{ content }} placeholders. Exactly one is allowed.`
- **Unknown placeholder name** — `HTML layout 'X' uses unknown placeholder {{ tilte }}.` (typo guard)
- **Named layout not found** — `HTML layout 'landing' not found in: <searched dirs>.` (no silent fallback to built-in shell)

## HTML comments are preserved verbatim

Placeholders inside `<!-- ... -->` are NOT substituted, and the comments make it to the output unchanged. Useful for documenting the layout's vocabulary inline:

```html
<!--
  Layout placeholders used here:
    {{ content }}       — rendered page body (REQUIRED)
    {{ head }}          — Markbook-required <head> bits (keep)
    {{ bodyEnd }}       — Markbook-required body-end scripts (keep)
    {{ search }}        — Pagefind search input slot
    {{ themeToggle }}   — dark/light toggle button
-->
```

## Minimal valid layout

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ browserTitle }}</title>
  {{ head }}
</head>
<body>
  <main>
    {{ pageActions }}
    <article data-pagefind-body>
      {{ content }}
    </article>
  </main>
  {{ bodyEnd }}
</body>
</html>
```

Drop this in `layouts/default.html`, set `layout: 'default'` in your config, and you have a custom-shell site with search, llms.txt, theme toggle, and all the SEO defaults — all from a single ~15-line file.

## Token classification (for the curious)

Internally, tokens fall into two classes:

- **Raw HTML** (substituted verbatim): `content`, `head`, `bodyEnd`, `pageActions`, `search`, `themeToggle`. These are Markbook-generated trusted markup.
- **Text** (HTML-escaped before substitution): `title`, `description`, `siteTitle`, `browserTitle`, plus every `frontmatter.x`. Frontmatter is escape-by-default to prevent accidental HTML injection.

This means it's safe to write:

```html
<meta name="author" content="{{ frontmatter.author }}">
```

— even if `author` happens to be `<script>alert(1)</script>`, the value gets HTML-escaped before substitution.
