# Markbook — agent conventions

This file is loaded into every Claude Code session in this repo.

## What Markbook is

A lightweight Storybook alternative. Authors write Markdown; stories live in adjacent `.tsx` / `.js` files referenced from markdown via `:::story{src=… export=…}` directives. Output is a static HTML site (Starlight-inspired layout — top header, grouped left nav, content, right TOC), with full-text search (Pagefind, v0.2) and an `llms.txt` mirror. Framework support is via thin mount adapters (React first; Vue and web components later).

Pages may also embed:
- A **props table** generated from a TypeScript component file via `react-docgen-typescript`. Set `component:` and optionally `componentExport:` in frontmatter; place a `:::props\n:::` directive where the table should render. The same table appears in the per-page `llms/<path>.txt`.
- A **code disclosure** under every rendered story, automatically. Source is extracted from the referenced `.stories.tsx` export via the TypeScript compiler API and highlighted with Shiki. The same code is embedded as a fenced `tsx` block in `llms/<path>.txt`.

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
- `pnpm typecheck` — type-check all packages
- `pnpm example:build` — build the React demo

## Style

- TypeScript everywhere. ESM only. Node ≥ 20.
- No comments unless the *why* is non-obvious. Identifiers should explain *what*.
- Prefer editing existing files over creating new ones.
