---
name: markbook-layout
description: Create or modify an HTML layout file for a Markbook site — gives you a known-good shell with all required `{{ }}` placeholders wired up, and registers it in markbook.config.ts.
trigger: When the user wants a custom HTML shell for their Markbook site (top nav, footer, marketing landing, blog template, ...) or asks how to replace Markbook's default chrome.
allowed-tools: Bash Read Grep Glob Edit Create
argument-hint: [layout-name] [--style docs|marketing|blog|minimal] [--dest <layoutsDir>] [--set-default]
---

# markbook-layout

Scaffolds an HTML layout for a Markbook site. Layouts REPLACE Markbook's
default `<html>...</html>` shell — they're Layer 3 of the four-layer
customization model (Layer 1: `css`; Layer 2: `disableBaseCss`; Layer 3:
`layoutsDir`; Layer 4: `transformHtml`). See the customization section of
`@doidor/markbook-core`'s README for the full ladder.

Each generated layout includes:

- `<title>{{ browserTitle }}</title>` and a `<meta name="description">` from
  frontmatter.
- `{{ head }}` — required for theme toggle, Pagefind CSS, base CSS, user CSS,
  and the inline boot scripts (tabs, permalinks, copy code, etc.) to work.
- `{{ bodyEnd }}` — required for Pagefind UI initialization and (on pages
  with stories) the entry script.
- `<article data-pagefind-body>{{ content }}</article>` — without
  `data-pagefind-body` Pagefind won't index the page; without `{{ content }}`
  the layout fails validation at build time.

## Inputs

- **`layout-name`** (required, positional) — the file's basename. Becomes
  `<layoutsDir>/<layout-name>.html`. Common names: `default`, `landing`,
  `post`, `chrome`.
- **`--style`** (optional) — one of `docs`, `marketing`, `blog`, `minimal`.
  Picks a starting template. Default: `minimal`.
- **`--dest`** (optional) — the `layoutsDir` to write into. Defaults to
  whatever `markbook.config.ts` already sets, or `./layouts/` if no
  `layoutsDir` is configured.
- **`--set-default`** (optional flag) — also set this layout as
  `config.layout` so every page uses it. Without this flag, only pages with
  matching `layout: <name>` frontmatter pick it up.

## Pre-checks

1. **Project root.** `view markbook.config.ts` from cwd; abort if missing
   (suggest `markbook-init` first).
2. **Layout name sanity.** Lowercase, kebab-case, no extension. If it ends
   in `.html`, strip it and warn the user.
3. **Don't clobber silently.** If `<dest>/<layout-name>.html` already exists,
   prompt before overwriting.

## Style templates

### `minimal`

The smallest layout that satisfies every validator. Useful as a starting
point for marketing / portfolio / single-page sites.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ browserTitle }}</title>
  <meta name="description" content="{{ description }}">
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

### `marketing`

Top nav (with search slot + theme toggle) + content article + footer.
Inspired by `examples/marketing-demo/layouts/default.html`. Includes the
client-side active-nav script.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ browserTitle }}</title>
  <meta name="description" content="{{ description }}">
  {{ head }}
</head>
<body>
  <nav class="site-nav">
    <a class="brand" href="/index.html">My Brand</a>
    <div class="site-nav-items">
      <a href="/index.html">Home</a>
      <a href="/about.html">About</a>
      <a href="/contact.html">Contact</a>
    </div>
    <div class="site-nav-search">{{ search }}</div>
    {{ themeToggle }}
  </nav>
  <script>
    (function () {
      var here = location.pathname.replace(/^\/+/, '') || 'index.html';
      var links = document.querySelectorAll('.site-nav-items a');
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href').replace(/^\/+/, '');
        if (href === here) links[i].setAttribute('aria-current', 'page');
      }
    })();
  </script>
  <main class="site-shell">
    {{ pageActions }}
    <article data-pagefind-body>
      {{ content }}
    </article>
  </main>
  <footer class="site-footer">
    <p>© Your company. <a href="/llms.txt">All pages as markdown ↓</a></p>
  </footer>
  {{ bodyEnd }}
</body>
</html>
```

### `blog`

Title + meta (date, author from frontmatter) + content + footer. Good for
post-style pages.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ browserTitle }}</title>
  <meta name="description" content="{{ description }}">
  <meta name="author" content="{{ frontmatter.author }}">
  {{ head }}
</head>
<body>
  <header class="post-header">
    <a href="/">← Back</a>
    {{ themeToggle }}
  </header>
  <main class="post">
    <h1>{{ title }}</h1>
    <p class="post-meta"><time>{{ frontmatter.date }}</time> · {{ frontmatter.author }}</p>
    <article data-pagefind-body>
      {{ content }}
    </article>
    {{ pageActions }}
  </main>
  {{ bodyEnd }}
</body>
</html>
```

### `docs`

Header brand + left nav placeholder + content + right TOC placeholder —
matches the built-in shell's structure but lets you restyle every wrapper
class without `disableBaseCss`.

NB: this style assumes you'll RENDER the nav / TOC yourself, since v1 of
the layout system intentionally doesn't expose `{{ nav }}` / `{{ toc }}`
placeholders. If you need a nav, either stick with the default shell, write
JS to populate it, or split your site into one layout per nav state. (Or
file an issue asking for the placeholders — current rationale is in
ADR-0024.)

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
  <header class="docs-header">
    <a class="docs-brand" href="/index.html">{{ siteTitle }}</a>
    {{ search }}
    {{ themeToggle }}
  </header>
  <div class="docs-shell">
    <aside class="docs-sidebar">
      <!-- Your nav goes here. Hand-rolled, or populated via JS. -->
    </aside>
    <main class="docs-main">
      {{ pageActions }}
      <article data-pagefind-body>
        {{ content }}
      </article>
    </main>
  </div>
  {{ bodyEnd }}
</body>
</html>
```

## Steps

1. **Read `markbook.config.ts`** to find the configured `layoutsDir` (default
   `'layouts'` if absent). If `--dest` was supplied, prefer that path.
2. **Ensure the layouts directory exists.** `mkdir -p <dest>`.
3. **Pick the template** based on `--style` (default `minimal`).
4. **Write `<dest>/<layout-name>.html`** with the chosen template. If the
   file exists, prompt before overwriting.
5. **Wire up the config** when needed:
   - If the config has no `layoutsDir` field and `--dest` is the default
     (`./layouts`), nothing to do.
   - Otherwise, add or update the `layoutsDir:` field.
   - If `--set-default` was supplied, also add `layout: '<layout-name>'` to
     the config.
6. **Suggest next steps.** Print the dev command (`markbook dev`) and
   remind the user that:
   - Per-page opt-in: add `layout: <layout-name>` to a page's frontmatter.
   - Opt out from a page when `config.layout` is set: `layout: false`.
   - Dev server hot-reloads layout changes.

## Placeholder reference (cheat sheet to keep in the layout's comments)

```html
<!--
  Layout placeholders:
    {{ content }}       — rendered page body (REQUIRED; exactly one)
    {{ head }}          — Markbook-required <head> bits (keep)
    {{ bodyEnd }}       — Markbook-required body-end scripts (keep)
    {{ search }}        — Pagefind search input slot (empty if search off)
    {{ themeToggle }}   — dark/light toggle button
    {{ pageActions }}   — View/Copy as Markdown buttons (empty if llmsButtons: false)
    {{ title }}         — page title (HTML-escaped)
    {{ description }}   — page description (HTML-escaped)
    {{ siteTitle }}     — config.title (HTML-escaped; empty if unset)
    {{ browserTitle }}  — what Markbook would put in <title> (HTML-escaped)
    {{ frontmatter.x }} — arbitrary frontmatter (HTML-escaped via dot path)
-->
```

## Gotchas

- The strict validator rejects unknown placeholder names — `{{ tilte }}`
  (typo) throws at build time. That's deliberate. Spell-check.
- Placeholders inside HTML comments are NOT substituted. The cheat sheet
  above is safe to paste anywhere in the layout.
- The text tokens AND every `{{ frontmatter.x }}` are HTML-escaped — safe to
  interpolate into attributes like `<meta content="...">`. Raw HTML tokens
  (`{{ content }}`, `{{ head }}`, `{{ bodyEnd }}`, `{{ pageActions }}`,
  `{{ search }}`, `{{ themeToggle }}`) pass through verbatim.
- A layout that omits `{{ head }}` silently breaks theme switching, search,
  copy-code, permalinks, and the per-page CSS. A layout that omits
  `{{ bodyEnd }}` breaks search initialization and (on story pages) the mount
  script. Always include them.
- A named layout that doesn't exist throws at build time — typos surface
  immediately rather than silently falling back to the built-in shell.

## Reference

- `@doidor/markbook-core/README.md` — full placeholder table + config docs.
- `DECISIONS.md` ADR-0024 — why layouts exist, what was considered, why the
  v1 placeholder set looks the way it does.
- `examples/marketing-demo/layouts/` — production-quality reference layouts
  (default + landing) with active-nav JS and a search slot in the top nav.
