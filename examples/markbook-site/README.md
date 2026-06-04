# Markbook site

The official [Markbook](https://github.com/microsoft/markbook) website, built with Markbook itself (eating our own dogfood).

## What's in here

- **Home** (`pages/index.md`) — landing page with a hero, feature grid, and links to the guides. Uses a custom `layouts/landing.html`.
- **Guides** (`pages/guides/*.md`) — getting started, adding stories, customization, search & SEO. Uses the **default Markbook chrome** (header + sidebar + content + TOC) with `--mb-*` token overrides in `markbook.css`.
- **Reference** (`pages/reference/*.md`) — config, CLI, frontmatter, layout placeholders, directives. Same default chrome.

This hybrid pattern — custom layout for the landing page, built-in shell everywhere else — is a common pattern for docs sites that want a marketing front door but standard docs chrome on every other page.

## Run it

```bash
# from the repo root
pnpm example:site:build      # build to examples/markbook-site/dist
pnpm example:site:dev        # dev server with hot reload
pnpm example:site:preview    # serve the built dist over HTTP
```

## Files

- `markbook.config.ts` — config: brand tokens, `siteUrl`, no adapter (markdown-only).
- `markbook.css` — `--mb-*` token overrides + landing-page-specific classes.
- `layouts/landing.html` — the home page's custom shell (hero, feature grid, no sidebar).
- `pages/` — markdown content.
- `public/favicon.svg` — branded favicon, copied to the dist root by Vite's `publicDir`.

## Why this is a worked example

The Markbook site is markdown-only with no adapter — it's a pure docs site that uses every customization layer except `disableBaseCss` (which the marketing demo demonstrates separately). It's the closest thing in the repo to a "real" Markbook deployment.
