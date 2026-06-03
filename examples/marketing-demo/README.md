# Marketing demo — Cumulus

A fictional cloud-platform marketing site, built with Markbook.

This demo is intentionally the polar opposite of the React / Vue / WC docs
demos. It exists to prove that Markbook isn't locked into a docs layout — the
same engine that renders a sidebar / TOC / content split can also render a
landing page with a hero, top nav, feature grids, pricing tiers, and a footer.

## What it demonstrates

| Layer                | Used here                                                            |
| -------------------- | -------------------------------------------------------------------- |
| `css`                | One hand-rolled `cumulus.css` with all the layout + chrome rules.    |
| `disableBaseCss`     | `true` — Markbook ships zero CSS; every selector is ours.            |
| `transformHtml`      | Strips the docs chrome (`<header>` / sidebar / TOC), injects a top   |
|                      | nav, footer, and a hero wrapper on the landing page.                 |
| `llmsButtons: false` | No "View as Markdown" / "Copy as Markdown" buttons.                  |
| `title` (omitted)    | Each page provides its own title via frontmatter; the header brand   |
|                      | renders "Cumulus" from our top-nav markup, not from `config.title`.  |

## Run it

```bash
# From the repo root:
pnpm example:marketing:build    # static site under examples/marketing-demo/dist
pnpm example:marketing:dev      # dev server with watch
```

## Files

- `markbook.config.ts` — turns off base CSS, points at `cumulus.css`, and
  rewrites every page's HTML in `transformHtml`.
- `cumulus.css` — ~330 lines, the entire visual surface. No `--mb-*` tokens
  used — we define our own `--c-*` token palette.
- `docs/` — five markdown pages: index, product, pricing, customers, contact.
  Page authors use plain markdown for body copy plus a handful of raw HTML
  wrappers (`<div class="feature-grid">`, `<div class="pricing-tier">`, etc.)
  for the marketing-style cards. CommonMark allows raw HTML and Markbook's
  `remark-rehype` is configured with `allowDangerousHtml: true`, so they
  pass through unmodified.

## What this proves

The default Markbook chrome is a convention, not a constraint. Three knobs
(`css`, `disableBaseCss`, `transformHtml`) are enough to turn the same engine
into a documentation site, a marketing site, a portfolio, an internal wiki, or
anything else that's "markdown driven, static HTML out".
