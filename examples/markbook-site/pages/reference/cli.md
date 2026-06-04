---
title: CLI reference
description: Every command, every flag.
---

# CLI reference

```bash
npx markbook <command> [options]
```

## `markbook build`

Build the static site to `<outDir>` (default `dist/`).

```bash
markbook build
```

| Flag | Purpose |
| --- | --- |
| `-c, --config <path>` | Path to a markbook config file. Defaults to `markbook.config.{ts,mts,js,mjs}` at the project root. |
| `--root <path>` | Project root (defaults to cwd). |

What runs:

1. Read every `.md` under `contentDir`, parse + render.
2. Resolve HTML layouts (per-page frontmatter > config default > built-in shell).
3. Vite bundles + minifies + copies `publicDir` to `outDir`.
4. `emitLlms` writes `llms.txt` + per-page mirrors.
5. `emitSitemapAndRobots` writes `sitemap.xml` + `robots.txt` (if `siteUrl` is set).
6. `runPagefind` builds the search index.

Output is fully static — deploy to any HTTP host.

## `markbook dev`

Start a Vite dev server with hot reload across markdown, CSS, layouts, and story files.

```bash
markbook dev
```

| Flag | Purpose |
| --- | --- |
| `-c, --config <path>` | Config file path. |
| `--root <path>` | Project root. |
| `--port <port>` | Override the dev port (default `5173`). |
| `--host <host>` | Bind to a specific host (e.g. `0.0.0.0` for LAN access). |

Pagefind, `llms.txt`, `sitemap.xml`, and `robots.txt` all generate in dev too — same outputs as production, just served from the in-memory build dir. ~80ms regeneration on a 5-page site.

## `markbook preview`

Serve the built `dist/` over HTTP. Use this to verify the production output locally — opening `dist/*.html` via `file://` breaks Pagefind (browsers block dynamic `import()` from cross-origin scripts).

```bash
markbook build
markbook preview
# → http://localhost:4173/
```

| Flag | Purpose |
| --- | --- |
| `-c, --config <path>` | Config file path. |
| `--root <path>` | Project root. |
| `--port <port>` | Override the preview port (default `4173`, or `dev.port + 1000` if `dev.port` is set). |
| `--host <host>` | Bind to a specific host. |

## `markbook bundle [storyId]`

Bundle one (or every) story as a portable artifact. See [adding stories →](../guides/adding-stories.html) for the workflow.

```bash
markbook bundle                          # all stories, embed mode (default)
markbook bundle my-button                # one story by ID
markbook bundle --mode package           # publishable npm package directory
markbook bundle --isolation shadow       # wrap each mount in an open shadow root
```

| Flag | Purpose |
| --- | --- |
| `-c, --config <path>` | Config file path. |
| `--root <path>` | Project root. |
| `--mode <mode>` | `embed` (default; self-mounting ESM) \| `package` (publishable npm). |
| `--isolation <mode>` | `shadow` to wrap each mount in an open shadow root (host-page CSS can't leak in). |

### `embed` mode

Produces `dist/embed/<slug>.js` per story. Drop a placeholder on any page:

```html
<div data-markbook-embed="my-button"></div>
<script type="module" src="https://cdn.example.com/embed/my-button.js"></script>
```

The script auto-mounts the story when the placeholder is in the DOM.

### `package` mode

Produces `dist/packages/<slug>/` — a publishable npm package directory with the framework as a peer dependency. Publish with `npm publish` and consumers can `npm install @your-scope/your-story`.

## `markbook skills install`

Install the user-facing agent skills shipped with the `markbook` npm package into your project's vendor surfaces (`.claude/`, `.codex/`, `.opencode/`, `.agents/`).

```bash
markbook skills install
```

| Flag | Purpose |
| --- | --- |
| `--surface <name>` | Install into a specific surface only (default: all surfaces detected in the project). |
| `--force` | Overwrite unmanaged content (skill directories created by hand). |
| `--update` | Refresh installed skills whose content drifted from the shipped version. |

After installation, agents that auto-discover skills from those directories pick up Markbook-specific helpers (`markbook-init`, `markbook-add-component-page`, `markbook-bulk-generate`, `markbook-style`, `markbook-layout`, `markbook-bundle-story`).

## `markbook skills list`

Show shipped + installed skills with their current state (installed / up-to-date / drifted / unmanaged).

```bash
markbook skills list
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `1` | Any error during the command (config load, build failure, layout validation, etc.). The error message is printed to stderr. |

All commands print `✓ Markbook <command> complete` (or equivalent) on success, `✗ Markbook <command> failed:` followed by the error on failure.
