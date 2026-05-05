# Markbook — agent conventions

This file is loaded into every Claude Code session in this repo.

## What Markbook is

A lightweight Storybook alternative. Authors write Markdown; stories live in adjacent `.tsx` / `.js` files referenced from markdown via `:::story{src=… export=…}` directives. Output is a static HTML site (Starlight-inspired layout — top header, grouped left nav, content, right TOC), with full-text search (Pagefind, v0.2) and an `llms.txt` mirror. Framework support is via thin mount adapters (React first; Vue and web components later).

Pages may also embed:
- A **props table** generated from a TypeScript component file via `react-docgen-typescript`. Set `component:` and optionally `componentExport:` in frontmatter; place a `:::props\n:::` directive where the table should render. The same table appears in the per-page `llms/<path>.txt`.
- A **code disclosure** under every rendered story showing the **whole story file** (imports + export) Shiki-highlighted. The convention is **one story per file**: each story lives in its own `.stories.{tsx,ts}` (typically grouped under a `<Component>/` folder next to the page) and uses `export default`, so directives can be just `:::story{src=./Foo/Bar.stories.tsx}` with no `export=` attribute. The same source is embedded as a fenced code block in `llms/<path>.txt`.

Stories are **portable** via `markbook bundle`:
- Default (embed mode): `dist/embed/<slug>.js` — fully self-contained ESM that auto-mounts on `<div data-markbook-embed="<slug>">` placeholders. No iframe.
- `--mode package`: `dist/packages/<slug>/` — a publishable npm package directory with the framework as a peer dep (declared in each adapter's `packagePeerDeps`).
- `--isolation=shadow`: each mount runs inside an open shadow root so host-page CSS doesn't leak in.
- Slugs default to a kebab-case version of the story file path relative to `docsDir`. Override per-story by adding `id=stable-name` to the directive: `:::story{src=./Foo.stories.tsx id=stable-name}` — useful when you rename files but want external embeds to keep working.

Stories share global providers (theme, i18n, router, ...) via **decorators** — an array of modules whose default exports wrap every story. Configure on the adapter, e.g. `reactAdapter({ decorators: ['./theme.tsx', './i18n.tsx'] })`. Decorators apply outer-to-inner, so the first array element becomes the outermost wrapper. The same decorator stack is inlined into embed and package mode bundles, so portable stories render identically out of context. WC stories don't have decorators (vanilla custom elements use a different composition model).

**Theming.** Each rendered page declares dark/light via `<html data-theme>`, set by an inline `<head>` script that reads `localStorage['markbook-theme']` first, falls back to `prefers-color-scheme`, and listens for clicks on `[data-markbook-theme-toggle]` to flip + persist. The colour palette is exposed entirely as `--mb-*` CSS variables (e.g. `--mb-bg`, `--mb-fg`, `--mb-accent`, `--mb-border`); a consumer can override theming by writing a small CSS file that sets these on `:root` (or scoped under `[data-theme="brand"]`). Code blocks use Shiki's dual-theme output (`themes: { light, dark }`, `defaultColor: false`) so syntax-highlighting follows `data-theme` without rebuilding.

A story file may also export `args`, `argTypes`, and `parameters`:
- `parameters` — display options for the placeholder element. `{ layout?: 'centered' | 'fullscreen' | 'padded'; background?: string }`. All adapters honour them.
- `args` — initial prop values. The default export becomes a render function `(args) => …`. React + Vue adapters honour them; WC ignores.
- `argTypes` — optional control-type metadata for each arg: `{ control: 'text' | 'number' | 'boolean' | 'select'; options?: [...] }`. If omitted, types are inferred from runtime values (boolean → checkbox, number → number input, else text).
- React's adapter exposes a `setupControls(controlsEl, args, argTypes, onChange)` helper, and `markbook build` / `markbook dev` wire up an interactive controls panel under every story whose source exports `args`. Changing a control re-mounts with new props (state preserved through React reconciliation).

Pages may also opt into a **template**: a markdown file in a templates directory that wraps the page's content with a shared shell. Opt in with `template: <name>` in frontmatter; the template uses `{{ title }}`, `{{ description }}`, `{{ content }}`, and `{{ frontmatter.x }}` substitution (no conditionals/loops — KISS). Pages without `template:` render their full markdown unchanged.

The template lookup directory is configured via `templatesDir` in `markbook.config.ts`. It accepts a single string or an array of strings (relative to the project root, or absolute). When given multiple paths the loader searches them in order and picks the first `<dir>/<name>.md` that exists, so shared templates can live outside the project (e.g. a sibling `../shared/templates`) and per-project templates can override them. Default: `'templates'`. See `examples/react-demo/templates/component.md` for the canonical pattern.

## Non-negotiables

1. **Markdown is the source of truth.** HTML and `llms.txt` are two views of one AST. Don't introduce features that put authoring content elsewhere.
2. **No framework code in `@markbook/core`.** React, Vue, etc. live in their adapter packages.
3. **Authoring stays simple.** A user with a markdown file and a story file should be able to run one command. Fight scope creep that adds config burden.

## Tracking discipline

Every change that affects user-facing behaviour, public APIs, or architecture must be recorded:

- Append an entry to `PROGRESS.md` using the slash command **`/markbook-log`** (or by hand in the same format).
- For non-obvious decisions, add a new ADR in `DECISIONS.md` and reference it from the PROGRESS entry.
- Update any other affected doc (READMEs, package descriptions, etc.) in the same change — never leave docs out of sync.

The harness reminds you (PostToolUse hook) and warns at session-end (Stop hook) if you edit `packages/**` without touching `PROGRESS.md`.

### Journal entry format

```
## YYYY-MM-DD — short title

**What changed:** one or two sentences, concrete.
**Why:** the user-facing or architectural reason.
**Next:** the one or two follow-ups that should come after this.
```

## Repo layout

```
packages/
  core/             — parser, builder, dev server (framework-agnostic)
  cli/              — `markbook` binary
  adapter-react/    — React mount adapter (+ Vite plugin glue)
examples/
  react-demo/       — dogfood example
```

## Commands

- `pnpm install` — install workspace
- `pnpm build` — build all packages
- `pnpm test` — run `@markbook/core` Vitest unit tests (parse, template, code, build helpers, embed slug)
- `pnpm typecheck` — type-check all packages
- `pnpm example:build` — build the React demo
- `pnpm example:bundle` — bundle React demo stories as embeddable ESM
- `pnpm example:embed-host:serve` — serve the embed-host workspace at `http://localhost:4500/embed-host/` (demonstrates both embed and package mode consumption)

## Style

- TypeScript everywhere. ESM only. Node ≥ 20.
- No comments unless the *why* is non-obvious. Identifiers should explain *what*.
- Prefer editing existing files over creating new ones.
