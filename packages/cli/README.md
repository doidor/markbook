# `markbook` — CLI

The command-line entry point for [Markbook](../../README.md). Loads
`markbook.config.{ts,mts,js,mjs}` from the project root and orchestrates
`@markbook/core` to build, serve, or bundle your docs.

## Install

```bash
npm install -D markbook @markbook/core
pnpm add -D markbook @markbook/core
yarn add -D markbook @markbook/core
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

### `markbook skills <action>`

Distribute Markbook's user-facing agent skills (procedural how-tos for
agent CLIs like Claude Code, Codex, OpenCode, Cursor) into the consumer
project's vendor surfaces. See [ADR-0022](../../DECISIONS.md) for design.

```
markbook skills install      # copy shipped skills into <vendor>/skills/markbook-<name>/
markbook skills list         # show shipped + installed, flag out-of-date
```

| Flag | Default | Description |
| --- | --- | --- |
| `--root <path>` | `cwd` | Project root |
| `--surface <name>` | detected | Limit to `.claude` / `.codex` / `.opencode` / `.agents` |
| `--symlink` | off (copy) | Symlink rather than copy. Avoid on Windows or pnpm. |
| `--update` | off | Refresh installed skills whose shipped content changed |
| `--force` | off | Overwrite skill dirs that lack our `.markbook-skill.json` metadata |

**Behaviour:**

- **Copy by default.** Symlinks dangle on pnpm's `.pnpm/<hash>` paths and on Windows. Each install drops a `.markbook-skill.json` recording the source hash + markbook version so `--update` is deterministic.
- **Flat namespace.** Skills land at `<surface>/skills/markbook-init/` (not `<surface>/skills/markbook/init/`) for cross-vendor portability.
- **Detect surfaces; don't create all four.** If your repo has only `.claude/`, only that gets a copy. If none exist, defaults to `.claude/`.
- **Refuses to clobber unmanaged content.** A pre-existing `<surface>/skills/markbook-init/` without our metadata is reported `skipped-unmanaged` — `--force` to override.

Shipped skills (v1):

| Skill | Purpose |
| --- | --- |
| `markbook-init` | Scaffold a new Markbook docs site (config + first page + sample story) |
| `markbook-add-component-page` | Generate one docs page for one component |
| `markbook-bulk-generate` | Bulk-generate docs pages for every component under a directory (dry-run default) |
| `markbook-style` | Apply a visual preset (`minimal` / `vibrant` / `corporate` / `github` / `nord`) + optional `--accent` / `--font` overrides |
| `markbook-layout` | Scaffold a custom HTML layout (`docs` / `marketing` / `blog` / `minimal` template) with all required `{{ }}` placeholders pre-wired, and register it in `markbook.config.ts` |
| `markbook-bundle-story` | Walk through `markbook bundle` for embedding stories externally |

After running `markbook skills install`, agents that auto-discover skills from those vendor directories will pick them up. Invocation syntax depends on the agent — `/markbook-init`, `@markbook-init`, etc.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Build / dev / bundle failed (stack trace printed to stderr) |
