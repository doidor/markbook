# Embed host example

A folder of static HTML pages that demonstrates the two ways to consume a Markbook story externally. Not a workspace package — just files served directly.

| Mode | File | How |
|---|---|---|
| Embed | [`embed.html`](./embed.html) | `<script type="module">` + `<div data-markbook-embed>` placeholder. Self-contained ESM, ~200 KB. |
| Package | [`package.html`](./package.html) | `<script type="importmap">` + `import { mount }` + manual `mount(el)` call. ~3.5 KB (React is a peer dep). |

Both pages render the Pixie **Button / Variants** story sourced from `examples/react-demo`.

## Run

```bash
# 1. Build the React demo, then both bundle modes (embed + package), all in one shot.
pnpm example:embed-host:build

# 2. Serve at http://localhost:4500/embed-host/
pnpm example:embed-host:serve
```

Open `http://localhost:4500/embed-host/` and click through to either demo page.

### Building one mode at a time

If you only need one bundle mode:

```bash
pnpm example:bundle           # embed mode → react-demo/dist/embed/*.js
pnpm example:bundle:package   # package mode → react-demo/dist/packages/<slug>/
```

The same `:package` suffix works for any future framework demo's bundle script, so you can mirror this workflow as more adapters land (Vue + Web Components are [planned](../../ROADMAP.md)).

## Notes

- The `serve` script roots Python's `http.server` at `examples/` so the host pages can reach `../react-demo/dist/{embed,packages}/...` via relative URLs.
- The package-mode importmap pulls React from `esm.sh` so the demo doesn't need a `node_modules`. In a real project you'd declare React as a dependency and bundle normally.
- The package mode bundle's filename is just `dist/index.js` (inside `dist/packages/<slug>/`) — the slug becomes the package name in the importmap.
