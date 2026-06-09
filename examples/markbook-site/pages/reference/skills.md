---
title: Skills reference
description: Every flag of every shipped agent skill. Use this when writing an AGENTS.md / CLAUDE.md, or when you need the exact invocation.
---

# Skills reference

Markbook ships six agent skills via `npx markbook skills install`. This page is the deep-dive for each one. For the why and the at-a-glance overview, see the [agent skills guide](../guides/agent-skills.html); for `markbook skills install` itself, see the [CLI reference](./cli.html#markbook-skills-install).

Every skill is invoked the same way as any agent skill — `/markbook-<name>` in Claude Code, `@markbook-<name>` in Codex, etc. (exact syntax depends on the agent).

## `markbook-init`

Scaffold a new Markbook documentation site in the current project.

```text
/markbook-init
```

**Generates** (refuses to clobber existing files):

- `markbook.config.ts` — uses `reactAdapter()` from `@doidor/markbook-adapter-react/config`.
- `docs/index.md` — sample home page with a description and a link to the example story.
- `docs/example/index.md` — example component page with one `:::story` directive.
- `docs/example/Example.stories.tsx` — minimal React story.

**Pre-checks:**

- Confirms a `package.json` exists at cwd. Aborts otherwise.
- Confirms React + ReactDOM are in `dependencies` / `devDependencies`. If missing, offers to install them alongside `@doidor/markbook-core` + `@doidor/markbook-adapter-react`.
- Refuses to clobber an existing `markbook.config.ts` (suggests deleting first).

**Suggested package.json scripts** (printed, then offered for one-by-one confirmation):

```bash
npm pkg set scripts.docs:build="markbook build"
npm pkg set scripts.docs:dev="markbook dev"
npm pkg set scripts.docs:bundle="markbook bundle"
```

## `markbook-add-component-page`

Generate one Markbook docs page for one component file.

```text
/markbook-add-component-page <component-path> [--output <docs-path>]
```

| Arg / flag | Required | Purpose |
| --- | --- | --- |
| `<component-path>` | yes | Path to the component source. Accepts relative (`./src/Button.tsx`), absolute, or bare specifier (`@my-org/button`). See [ADR-0021](https://github.com/doidor/markbook/blob/main/DECISIONS.md) for the full spectrum. |
| `--output <docs-path>` | no | Destination markdown file. Defaults to `docs/components/<Name>.md`. |

**Output:**

- A docs page with frontmatter (`title`, `description`, optional `template:`, `component:`, `componentExport:`) and a `:::stories{src=./<Name>/<Name>.stories.tsx}` directive.
- A sibling stories file with a starter `Default` export.

**Conventions:**

- Detects the primary export name (PascalCase named export matching the basename, or the `default` export).
- Extracts JSDoc summary above the component as the page description. If absent, uses `'TODO: describe <Name>'`.
- Skips `template:` if no `_layouts/component.md` template is configured.
- Skips `componentExport:` if the file has a single export (Markbook auto-detects).

## `markbook-bulk-generate`

Generate Markbook docs pages for every component under a directory. **Dry-run by default.**

```text
/markbook-bulk-generate --from <src-dir> [--output <docs-dir>] [--include <glob>] [--exclude <glob>] [--write]
```

| Flag | Required | Purpose |
| --- | --- | --- |
| `--from <src-dir>` | yes | Directory to scan. No default, deliberately — bulk operations should always be explicit about scope. |
| `--output <docs-dir>` | no | Where the pages land. Defaults to `docs/components/`. |
| `--include <glob>` | no (repeatable) | Narrow the scan beyond the default `**/*.{tsx,jsx}`. |
| `--exclude <glob>` | no (repeatable) | Skip additional files beyond `*.test.*`, `*.spec.*`, `*.stories.*`, and `index.*`. |
| `--write` | no | Actually write the files. Without this, only the candidate list is printed. |

**Heuristics — conservative on purpose:**

- React (`.tsx`/`.jsx`): file must have at least one PascalCase export that returns JSX.
- TypeScript-only utility files (`.ts` without JSX): skipped.
- A missed component is one `/markbook-add-component-page` away; a generated page for a utility file is noise the user has to delete.

**Output shape (dry-run):**

```text
Source                                 → Generated docs page
──────────────────────────────────────────────────────────────────
src/components/Button/Button.tsx       → docs/components/Button.md
src/components/Card/Card.tsx           → docs/components/Card.md
                                   (2 components found)
```

Skipped files are listed with reasons ("no JSX returned", "test file", etc.).

## `markbook-style`

Apply a pre-baked visual preset to a Markbook site.

```text
/markbook-style <preset> [--accent <hex>] [--font <family>] [--dest <path>]
```

| Arg / flag | Required | Purpose |
| --- | --- | --- |
| `<preset>` | yes | One of `minimal`, `vibrant`, `corporate`, `github`, `nord`. |
| `--accent <hex>` | no | Override `--mb-accent` (and `--mb-link`) on top of the preset. |
| `--font <family>` | no | Override `--mb-font-sans`. Quote multi-word: `'"JetBrains Sans", system-ui'`. |
| `--dest <path>` | no | Output file relative to project root. Default `./markbook.css`. |

**Available presets:**

| Preset | Feel | Accent | Notes |
| --- | --- | --- | --- |
| `minimal` | Quiet, low-contrast, narrow | `#444` | Achromatic, serif. Best for prose-heavy docs. |
| `vibrant` | Bold, generous spacing, modern | `#7c3aed` | Strong purple. Bigger headings. |
| `corporate` | Traditional, dense | `#1e40af` | Muted blue/gray. Conservative type. |
| `github` | Mimics GitHub Docs | `#0969da` | System font stack, blue accent. |
| `nord` | Cool, calm, designer-y | `#5e81ac` | Full Nord palette. |

**Behaviour:**

- Writes the (possibly mutated) preset CSS to `--dest`.
- Wires `<dest>` into `markbook.config.ts`'s `css:` field — appends if the array exists, inserts otherwise.
- Re-runs detect the previous output via the marker comment `/* markbook style preset: <name> */` and overwrite without prompting. Foreign files at `<dest>` prompt before overwriting.

**Adding your own preset:** copy `presets/<name>.css` inside the installed skill directory and edit. The marker comment is required so re-runs can detect-and-overwrite cleanly. PR to [`packages/cli/skills/style/presets/`](https://github.com/doidor/markbook/tree/main/packages/cli/skills/style/presets) to upstream it.

## `markbook-layout`

Create or modify a custom HTML layout for a Markbook site.

```text
/markbook-layout <layout-name> [--style docs|marketing|blog|minimal] [--dest <layoutsDir>] [--set-default]
```

| Arg / flag | Required | Purpose |
| --- | --- | --- |
| `<layout-name>` | yes | Becomes `<layoutsDir>/<layout-name>.html`. Lowercase, kebab-case, no extension. |
| `--style` | no | Starting template: `docs`, `marketing`, `blog`, `minimal`. Defaults to `minimal`. |
| `--dest` | no | The `layoutsDir`. Defaults to what `markbook.config.ts` sets, or `./layouts/`. |
| `--set-default` | no (flag) | Also sets the layout as `config.layout` so every page uses it (override per-page via `layout: <name>` frontmatter). |

**Style templates:**

- `minimal` — the smallest layout that satisfies every validator; useful starting point for marketing / portfolio / single-page sites.
- `marketing` — top nav (search slot + theme toggle) + content article + footer + active-nav JS. Mirrors `examples/marketing-demo/layouts/default.html`.
- `blog` — title + meta (date, author from frontmatter) + content + footer.
- `docs` — header brand + left nav placeholder + content + right TOC placeholder — matches the built-in shell structure but lets you restyle every wrapper class without `disableBaseCss`.

**Placeholder cheat sheet** (kept as a comment in every generated layout):

| Placeholder | What it expands to |
| --- | --- |
| `{{ content }}` | Rendered page body (REQUIRED — exactly one). |
| `{{ head }}` | Markbook-required `<head>` bits — boot scripts, Pagefind CSS, BASE_CSS, user CSS. |
| `{{ bodyEnd }}` | Markbook-required body-end scripts — Pagefind init, story entry. |
| `{{ search }}` | Pagefind search input slot (empty if search off). |
| `{{ themeToggle }}` | Dark/light toggle button. |
| `{{ pageActions }}` | "View / Copy as Markdown" buttons. |
| `{{ title }}` | Page title (HTML-escaped). |
| `{{ description }}` | Page description (HTML-escaped). |
| `{{ siteTitle }}` | `config.title` (empty if unset). |
| `{{ browserTitle }}` | What Markbook would put in `<title>`. |
| `{{ frontmatter.x }}` | Arbitrary frontmatter via dot path (HTML-escaped). |

See [placeholders reference →](./placeholders.html) for the formal contract.

:::callout{type=warning}
Layouts that omit `{{ head }}` silently break theme switching, search, copy-code, permalinks, and per-page CSS. Layouts that omit `{{ bodyEnd }}` break search init and (on story pages) the mount script. Always include them.
:::

## `markbook-bundle-story`

Walk through `markbook bundle` for embedding a story externally.

```text
/markbook-bundle-story <storyId> [--mode embed|package] [--isolation shadow]
```

| Arg / flag | Required | Purpose |
| --- | --- | --- |
| `<storyId>` | yes | Stable kebab-case slug (e.g. `components-button-variants`). Find it in `dist/embed/index.html` after a build. |
| `--mode` | no | `embed` (default — self-mounting ESM) or `package` (publishable npm). |
| `--isolation` | no | `shadow` to wrap the mount in an open shadow root. |

**Mode selection rule of thumb:**

| Mode | When | Output | Approx size |
| --- | --- | --- | --- |
| `embed` | Drop on any HTML page via one `<script type="module">` | `dist/embed/<slug>.js` (self-contained) | ~200 KB (React story; framework bundled in) |
| `package` | Host project provides the framework as a peer dep, bundles via npm | `dist/packages/<slug>/` (publishable directory) | ~3.5 KB (React story) |

**Embed mode usage** (host page):

```html
<div data-markbook-embed="<storyId>"></div>
<script type="module" src="path/to/dist/embed/<storyId>.js"></script>
```

**Package mode usage** (host page, via importmap):

```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react-dom": "https://esm.sh/react-dom@18.3.1",
    "<storyId>": "path/to/dist/packages/<storyId>/dist/index.js"
  }
}
</script>
<div id="here"></div>
<script type="module">
  import { mount } from '<storyId>';
  mount(document.getElementById('here'));
</script>
```

**Common failure modes:**

- **"duplicate story slug"** — two stories collide on the same slug. Add `:::story{... id=unique-slug}` to one of them.
- **Story renders blank** — usually the host's placeholder uses the wrong slug. Compare to the bundle filename.
- **Story renders unstyled in shadow mode** — your component's CSS tokens are declared on `:root` only. Add `:host` to the selector list.

See [ADR-0006](https://github.com/doidor/markbook/blob/main/DECISIONS.md) for the embed-vs-package design rationale.

## Where the skills live

Shipped in the npm package at `node_modules/@doidor/markbook/skills/<name>/SKILL.md`. After `markbook skills install`, copies (or symlinks, with `--symlink`) land at:

```text
.claude/skills/markbook-<name>/SKILL.md      # Claude Code
.codex/skills/markbook-<name>/SKILL.md       # Codex
.opencode/skills/markbook-<name>/SKILL.md    # OpenCode
.agents/skills/markbook-<name>/SKILL.md      # Cursor / generic
```

Each install drops a `.markbook-skill.json` sidecar with the source hash + markbook version so `markbook skills install --update` is deterministic.

Source code: [`packages/cli/skills/`](https://github.com/doidor/markbook/tree/main/packages/cli/skills) in the Markbook monorepo.

## Why agent-first?

Markbook bakes agent skills into the npm package — not a separate `@markbook/skills` plugin, not a docs-only convention. See the [agent skills guide](../guides/agent-skills.html#why-agent-first) for the design rationale; [ADR-0022](https://github.com/doidor/markbook/blob/main/DECISIONS.md) covers the distribution mechanism.
