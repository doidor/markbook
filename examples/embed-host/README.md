# Embed host example

A folder of static HTML pages that demonstrates the two ways to consume a Markbook story externally. Not a workspace package — just files served directly.

| Mode | File | How |
|---|---|---|
| Embed | [`embed.html`](./embed.html) | `<script type="module">` + `<div data-markbook-embed>` placeholder. Self-contained ESM, ~200 KB. |
| Package | [`package.html`](./package.html) | `<script type="importmap">` + `import { mount }` + manual `mount(el)` call. ~3.5 KB (React is a peer dep). |

Both pages render the Pixie **Button / Variants** story sourced from `examples/react-demo`.

## Run

1. Generate the bundles from the React demo:
   ```
   pnpm example:bundle
   pnpm --filter @markbook/example-react-demo exec markbook bundle \
       components-button-variants --mode package
   ```
2. Serve this directory:
   ```
   pnpm example:embed-host:serve   # http://localhost:4500/embed-host/
   ```
3. Open `http://localhost:4500/embed-host/` and click through to the embed and package demos.

## Notes

- The `serve` script roots Python's `http.server` at `examples/` so the host pages can reach `../react-demo/dist/{embed,packages}/...` via relative URLs.
- The package-mode importmap pulls React from `esm.sh` so the demo doesn't need a node_modules. In a real project you'd declare React as a dependency and bundle normally.
