---
title: Frontmatter reference
description: Per-page YAML fields Markbook recognizes in the frontmatter block.
---

# Frontmatter reference

Every page can start with a YAML frontmatter block:

```yaml
---
title: My Page
description: A short blurb shown as the page's <meta description> and og:description.
---
```

Markbook recognizes the following fields. Any field not listed here is passed through to your layout via `{{ frontmatter.x }}` — Markbook doesn't reject unknown fields.

## Core

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `title` | `string` | First H1, then file ID | Page title. Used for `<title>`, sidebar label, OG/Twitter titles. |
| `description` | `string` | `config.description` | Used as `<meta name="description">`, `og:description`, `twitter:description`, AND in the `llms.txt` index entry. |

## Layout selection

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `layout` | `string \| false` | `config.layout` | Pick an HTML layout `<layoutsDir>/<name>.html`. Set to `false` to force the built-in shell even when `config.layout` is set. |
| `template` | `string` | (none) | Wrap the page's markdown content inside `<templatesDir>/<name>.md`. The template uses `{{ content }}` + `{{ frontmatter.x }}` substitution. Markdown-level, not HTML-level — see [customization →](../guides/customization.html) for the layouts vs templates distinction. |

## SEO

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `ogImage` | `string` | `config.ogImage` | Per-page Open Graph / Twitter image (absolute URL). When set, Twitter Card type bumps from `summary` to `summary_large_image`. |

## Component stories (props table)

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `component` | `string` | (none) | Path to the component file (relative to the markdown page, or a bare specifier like `@my-org/components/Button`). Used by the `:::props` directive. |
| `componentExport` | `string` | `'default'` | Named export within the `component` file. |

## Arbitrary fields

Any other frontmatter field is available in HTML layouts via the `{{ frontmatter.<dot.path> }}` placeholder:

```yaml
---
title: Post
author: Tudor
date: 2026-06-04
tags: [markbook, docs]
---
```

```html
<!-- layouts/post.html -->
<article>
  <header>
    <h1>{{ title }}</h1>
    <p>By {{ frontmatter.author }} on <time>{{ frontmatter.date }}</time></p>
  </header>
  {{ content }}
</article>
```

Values are HTML-escaped before substitution (safe to interpolate into attributes), and arrays/objects are JSON-stringified.

## Validation

Markbook validates a small set of fields:

- `layout: true` (or any non-string, non-`false` value) → throws.
- `template: <missing-name>` → throws with the searched directories listed.
- Unknown `{{ frontmatter.X }}` paths in a layout → render as the empty string (not an error — frontmatter is intentionally flexible).

Everything else is the layout author's responsibility.

## Example

A page that opts into a custom layout, sets per-page SEO, and uses arbitrary frontmatter for a blog post:

```yaml
---
title: Markbook 1.0 is out
description: Markdown, stories, search, layouts — all the things.
layout: post
ogImage: https://markbook.example/og/1-0.png
author: Tudor Toma
date: 2026-06-04
tags: [release, markbook]
---
```
