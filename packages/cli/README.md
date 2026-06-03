# `markbook` — CLI

The command-line entry point for [Markbook](../../README.md). Loads
`markbook.config.{ts,mts,js,mjs}` from the project root and orchestrates
`@markbook/core` to build, serve, or bundle your docs.

## Install

```bash
pnpm add -D markbook @markbook/core
```

Pair with a framework adapter (`@markbook/adapter-react`,
`@markbook/adapter-vue`, or `@markbook/adapter-wc`).

## Commands

```
markbook build                  # static site in dist/
markbook dev                    # dev server with HMR
markbook bundle [storyId]       # portable bundles in dist/embed/ or dist/packages/
```

### `markbook build`

Generate the static documentation site.

| Flag | Default | Description |
| --- | --- | --- |
| `-c, --config <path>` | auto-discovered | Path to `markbook.config.{ts,mts,js,mjs}` |
| `--root <path>` | `cwd` | Project root |

Output goes to `dist/` (configurable via `outDir`):

```
dist/
  index.html
  <pages>/<name>.html       # one HTML file per .md
  assets/                   # Vite-hashed JS/CSS chunks
  pagefind/                 # Pagefind search index + UI
  llms.txt                  # llmstxt.org-format summary
  llms/<page>.txt           # per-page plain-text mirror
```

### `markbook dev`

Start the Vite-backed dev server. Watches markdown, templates, story files,
and user CSS via chokidar; component/story `.tsx`/`.vue`/etc. hot-reload
through Vite.

| Flag | Default | Description |
| --- | --- | --- |
| `-c, --config <path>` | auto-discovered | Path to config |
| `--root <path>` | `cwd` | Project root |
| `--port <port>` | 5173 | Port to bind to |
| `--host <host>` | (Vite default) | Host to bind to |

### `markbook bundle [storyId]`

Bundle stories as portable artefacts. Without `storyId`, bundles every story
in the workspace; with one, only the matching slug.

| Flag | Default | Description |
| --- | --- | --- |
| `-c, --config <path>` | auto-discovered | Path to config |
| `--root <path>` | `cwd` | Project root |
| `--mode <mode>` | `embed` | `embed` (self-mounting ESM) or `package` (publishable npm) |
| `--isolation <mode>` | none | `shadow` to mount each story inside an open shadow root |

**embed mode** writes `dist/embed/<slug>.js`. Each bundle auto-mounts on
every `<div data-markbook-embed="<slug>">` placeholder it finds in the host
page — drop in one `<script type="module">` and you're done.

**package mode** writes `dist/packages/<slug>/` as a publishable npm package
(`package.json`, `dist/index.js`, `README.md`). The framework runtime stays
external as a peer dependency, so the consumer's React/Vue is reused.

`--isolation=shadow` wraps each mount in `attachShadow({ mode: 'open' })` so
host-page CSS doesn't leak in.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Build / dev / bundle failed (stack trace printed to stderr) |
