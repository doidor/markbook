---
name: bundle-story
description: Produce an embed bundle for a story and smoke-test that it renders in the embed-host workspace.
trigger: When asked to "bundle <story>", "make an embed for <story>", or after adding a new story that needs external embedding.
allowed-tools: Bash Read Grep Glob Edit
argument-hint: [storyId|all] [--mode embed|package] [--isolation shadow]
---

# bundle-story

## Inputs

- `storyId` — slug from the embed sandbox (`dist/embed/index.html`) or `all` (default).
- `--mode` — `embed` (default; self-mounting ESM) or `package` (publishable npm dir).
- `--isolation` — `shadow` to wrap each mount in an open shadow root.

## Steps

1. **Bundle from the demo workspace** (React demo most commonly):
   ```bash
   pnpm --filter @markbook/example-react-demo exec markbook bundle [storyId] [--mode package] [--isolation shadow]
   ```
   For other demos use `@markbook/example-vue-demo` or `@markbook/example-wc-demo`.
2. **Verify the output:**
   - Embed: `ls examples/react-demo/dist/embed/` — should contain `<slug>.js` + `index.html` (the sandbox)
   - Package: `ls examples/react-demo/dist/packages/<slug>/` — `package.json`, `dist/index.js`, `README.md`
3. **Smoke-test in the embed-host workspace.** From the repo root:
   ```bash
   pnpm example:embed-host:serve
   ```
   Open `http://localhost:4500/embed-host/embed.html` (for embed mode) or `.../package.html` (for package mode). The story should render. Kill the server when done.
4. **`:::stories` fan-outs produce N bundles** — one per named export, slug pattern `<page-slug>-<kebab-export>`. Singleton `:::story` keeps the bare slug.

## Common failure modes

- **"duplicate story slug"** — two stories collide on the same slug. Disambiguate via `:::story{… id=unique-slug}` on one of them.
- **Story renders blank in the host page** — usually the host's `<div data-markbook-embed="<slug>">` placeholder uses the wrong slug, OR the bundle's framework runtime can't find `react`/`vue` (package mode only). For package mode the host must provide the framework via an importmap.

## Prevention tests

- The slug used in the host page's placeholder MUST match the bundle filename (kebab-case, no `.js`).
- For shadow isolation, host page CSS resets do NOT reach into the shadow root — by design.

## Related ADRs
- ADR-0006 — story portability (embed vs package mode)
- ADR-0012, ADR-0013 — implementation details
