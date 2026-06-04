---
title: Customization
description: Four layers, each opt-in — from CSS variables to full HTML shell replacement.
---

# Customization

Markbook layers customization from "smallest change you might want" to "I want to write the HTML myself." Pick the smallest one that solves your problem.

| Layer | What it does | Use when |
| --- | --- | --- |
| 1. `css` | Inline your CSS after Markbook's built-in styles | You just want to recolor, change fonts, or restyle a few elements |
| 2. `disableBaseCss` | Opt out of the built-in chrome stylesheet entirely | You want to design every element from scratch (often paired with layer 3) |
| 3. `layoutsDir` + `layout` | Replace Markbook's `<html>` shell with your own HTML files | You want a marketing landing, a blog template, anything that isn't a docs chrome |
| 4. `transformHtml` | Post-process every page's final HTML string | Narrow tweaks — analytics injection, attribute rewrites, structured-data tags |

Each layer is opt-in; you can use one, two, all four, or none.

## Layer 1 — Token overrides (`css`)

The cheapest fix. Markbook's chrome is driven by CSS variables (`--mb-bg`, `--mb-fg`, `--mb-accent`, `--mb-link`, `--mb-content-width`, ...). Override them in a CSS file:

```css
/* markbook.css */
:root {
  --mb-accent: #ff6b35;
  --mb-link: #ff8552;
  --mb-content-width: 880px;
  --mb-font-sans: 'Inter', system-ui;
}
:root[data-theme="dark"] {
  --mb-accent: #ff9b80;
}
```

Wire it into `markbook.config.ts`:

```ts
export default defineConfig({
  css: ['./markbook.css'],
});
```

Done. Markbook inlines your CSS after `BASE_CSS` so your overrides win. No HTML changes needed.

## Layer 2 — Drop the built-in chrome (`disableBaseCss`)

When you want every selector to be yours:

```ts
export default defineConfig({
  css: ['./my-styles.css'],
  disableBaseCss: true,
});
```

Markbook now ships **zero CSS** for the chrome. Your stylesheet is responsible for everything — header layout, nav, content typography, code blocks, the lot.

Markbook still emits its stable DOM contract (`.markbook-header`, `.markbook-sidebar`, `.markbook-content`, `.markbook-toc`, `[data-pagefind-body]`, `[data-markbook-theme-toggle]`, ...) — you just write all the rules.

This is usually paired with layer 3 below, since at that point you might as well swap the shell too.

## Layer 3 — HTML layouts (`layoutsDir`)

When the docs shell isn't what you want at all — marketing site, blog, portfolio — write your own HTML.

Set up a layouts directory:

```ts
export default defineConfig({
  layoutsDir: 'layouts',       // string or string[]
  layout: 'default',           // default layout for every page
});
```

Create `layouts/default.html`:

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
  <header>
    <a href="/">My Site</a>
    {{ search }}
    {{ themeToggle }}
  </header>
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

Per-page opt-in via frontmatter:

```yaml
---
layout: landing   # uses layouts/landing.html instead of the default
---
```

Set `layout: false` in frontmatter to force the built-in shell on a single page even when `config.layout` is set.

Layouts are validated strictly:

- Missing `{{ content }}` placeholder → throws.
- More than one `{{ content }}` → throws.
- Unknown placeholder name (typo guard) → throws.
- Named layout file not found → throws (no silent fallback).
- HTML comments are preserved verbatim — placeholders inside `<!-- ... -->` are NOT substituted.

See [placeholder reference →](../reference/placeholders.html) for the full token list.

## Layer 4 — Post-process (`transformHtml`)

Sometimes you need to mutate the final HTML — inject an analytics snippet, rewrite a specific attribute, add JSON-LD structured data. `transformHtml` runs last, after either the built-in shell or your layout has produced output:

```ts
export default defineConfig({
  transformHtml: async (html, page) => {
    // Add Google Analytics
    return html.replace(
      '</head>',
      `<script async src="https://www.googletagmanager.com/gtag/js?id=GA_X"></script></head>`,
    );
  },
});
```

The callback gets:

- `html` — the fully-rendered HTML string
- `page` — `{ relPath, htmlRelPath, title, frontmatter }` for per-page decisions

Use sparingly. If you find yourself doing more than a regex or two, you probably want a layout instead.

## A worked example

[`examples/marketing-demo/`](https://github.com/microsoft/markbook/tree/main/examples/marketing-demo) in the Markbook repo combines layers 2 + 3:

- `disableBaseCss: true` — Markbook ships zero CSS.
- `layoutsDir: 'layouts'` + `layout: 'default'` — replaces the docs shell with a marketing layout (top nav + content + footer).
- Per-page frontmatter `layout: landing` on the home page only — opts into a hero-style variant.
- A hand-rolled `cumulus.css` with ~560 lines covering everything.

Result: a navy + coral marketing site for a fictional cloud platform. Same engine, totally different output.

## Next steps

- [Search & SEO →](./search-and-seo.html) — what the SEO defaults give you.
- [Config reference →](../reference/config.html) — full options.
- [Placeholder reference →](../reference/placeholders.html) — every layout token.
