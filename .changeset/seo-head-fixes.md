---
"@doidor/markbook-core": patch
---

**Fix three SEO `<head>` footguns** (#21).

- **Canonical/`og:url` collapse `index.html`.** The homepage now emits
  `<link rel="canonical" href="https://site.com/">` (and matching `og:url`)
  instead of `…/index.html`; a section index becomes `…/guides/`. This
  matches what `sitemap.xml` already did — the two are now derived from one
  shared `canonicalPageUrl` helper, so they can't drift.
- **No duplicated site title.** The `<title>` / `og:title` / `twitter:title`
  string is `<page> — <site>`, but when the page title already equals
  `config.title` (typical on the homepage) it's used once — no
  `My Site — My Site`.
- **No duplicated `<meta name="description">`.** When a custom HTML layout
  hand-writes its own `<meta name="description" content="{{ description }}">`,
  Markbook detects it and skips its built-in one (the `og:`/`twitter:`
  description variants are still injected).

All three previously required a fragile `transformHtml` string-replace to fix.
