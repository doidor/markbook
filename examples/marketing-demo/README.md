# Marketing demo — Cumulus

A fictional cloud-platform marketing site, built with Markbook.

This demo is intentionally the polar opposite of the React / Vue / WC docs
demos. It exists to prove that Markbook isn't locked into a docs layout — the
same engine that renders a sidebar / TOC / content split can also render a
landing page with a hero, top nav, feature grids, pricing tiers, and a footer.

## What it demonstrates

| Layer / config            | Used here                                                            |
| ------------------------- | -------------------------------------------------------------------- |
| `contentDir: 'pages'`     | Pages live in `pages/`, not the default `docs/`. (`docsDir` is the   |
|                           | legacy alias — new sites should prefer `contentDir`.)                |
| `css`                     | One hand-rolled `cumulus.css` with all the layout + chrome rules.    |
| `disableBaseCss`          | `true` — Markbook ships zero CSS; every selector is ours.            |
| `layoutsDir: 'layouts'` + | Markbook's default HTML shell is REPLACED by `layouts/default.html`  |
| `layout: 'default'`       | for every page. `index.md` opts into `layouts/landing.html` for the  |
|                           | hero treatment via frontmatter `layout: landing`.                    |
| Search (default)          | Pagefind UI mounts into the `{{ search }}` slot in the top nav.      |
|                           | The dev server runs Pagefind on the tmpDir too — search works in     |
|                           | both `markbook dev` AND `markbook build`.                            |
| `llms.txt` (default)      | Top-level `/llms.txt` index + per-page `/llms/<page>.txt` mirrors.   |
|                           | The layout's footer Resources column links to `/llms.txt`; the       |
|                           | `{{ pageActions }}` slot above each article surfaces per-page        |
|                           | "View / Copy as Markdown" buttons. All emitted in dev too.           |
| `title` (omitted)         | Each page provides its own title via frontmatter; the brand text     |
|                           | "Cumulus" lives in the layouts' top-nav markup, not in `config.title`.|

## Run it

```bash
# From the repo root:
pnpm example:marketing:build    # static site under examples/marketing-demo/dist
pnpm example:marketing:dev      # dev server with watch (edits to layouts/, pages/, cumulus.css all reload)
```

## Files

- `markbook.config.ts` — 35 lines, no JS-string-mutation. Points at `pages/`,
  registers two layouts, disables base CSS, and that's it.
- `cumulus.css` — ~560 lines, the entire visual surface. No `--mb-*` tokens
  used — we define our own `--c-*` token palette.
- `layouts/default.html` — the standard shell: top sticky nav (with search
  slot + active-link JS) + content article + footer (with `/llms.txt` link).
- `layouts/landing.html` — same shell plus a hero section that pulls
  `{{ title }}` and `{{ description }}` from frontmatter into a centered
  marketing block with CTA buttons.
- `pages/` — five markdown pages: index, product, pricing, customers, contact.
  Page authors use plain markdown for body copy plus a handful of raw HTML
  wrappers (`<div class="feature-grid">`, `<div class="pricing-tier">`, etc.)
  for the marketing-style cards. CommonMark allows raw HTML and Markbook's
  `remark-rehype` is configured with `allowDangerousHtml: true`, so they
  pass through unmodified.
- `public/` — static assets Markbook copies verbatim to the build output's
  root. We ship a coral-tinted `favicon.svg` (referenced from both layouts)
  and a `humans.txt` (web-standard `humanstxt.org` file). Drop OG images,
  fonts, `.well-known/`, or any other static file here and it appears at
  `/<filename>` in both dev and build.

## Layout placeholders used here

| Token              | Where it appears in our layouts                                  |
| ------------------ | ---------------------------------------------------------------- |
| `{{ content }}`    | Inside `<article class="cumulus-content" data-pagefind-body>`    |
| `{{ head }}`       | Inside `<head>`, after our own `<title>` and meta tags           |
| `{{ bodyEnd }}`    | Just before `</body>` — Pagefind UI init lives here              |
| `{{ search }}`     | Inside `.cumulus-topnav-search` in the top nav                   |
| `{{ pageActions }}`| Just above each page's content article                           |
| `{{ browserTitle }}` | Inside our own `<title>` tag                                   |
| `{{ description }}`| Inside `<meta name="description">` and (in landing.html) the hero `<p>` |
| `{{ title }}`      | Inside the hero `<h1>` on landing.html                           |

## What this proves

The default Markbook chrome is a convention, not a constraint. Four knobs
(`css`, `disableBaseCss`, `layoutsDir`, `transformHtml`) are enough to turn
the same engine into a documentation site, a marketing site, a portfolio, an
internal wiki, or anything else that's "markdown driven, static HTML out" —
without writing any JS that mutates Markbook's output.

