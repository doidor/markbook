# Markbook — agent conventions

This file is loaded into every Claude Code session in this repo.

## What Markbook is

A lightweight Storybook alternative. Authors write Markdown; stories live in adjacent `.tsx` / `.ts` / `.js` files referenced from markdown via two directives:

- `:::story{src=… [export=…] [id=…]}` — one rendered story per directive. The story file's `export default` is the renderer; the disclosure shows the **whole file**.
- `:::stories{src=… [only=A,B] [exclude=C] [id=…]}` — multi-export CSF v3 file. Fans out to one rendered story per named export, each with its OWN sliced disclosure (imports + non-export helpers + just that export's declaration). Each export may be a render function or a CSF object `{ render, args?, argTypes?, parameters?, name? }`; detection requires `render` AND at least one metadata field so Vue `defineComponent` / React `forwardRef` are not misclassified.

Output is a static HTML site (Starlight-inspired layout — top header, grouped left nav, content, right TOC), with full-text search (Pagefind) and an `llms.txt` mirror. Framework support is via thin mount adapters (React, Vue, web components).

Pages may also embed:
- A **props table** generated from a TypeScript component file via `react-docgen-typescript`. Set `component:` and optionally `componentExport:` in frontmatter; place a `:::props\n:::` directive where the table should render. The same table appears in the per-page `llms/<path>.txt`.
- A **code disclosure** under every rendered story, Shiki-highlighted with dual light/dark themes. Singleton `:::story` shows the whole file; `:::stories` slices each export. Sibling CSS imports (`*.module.css`, etc.) are surfaced as additional tabs in the disclosure.

Stories are **portable** via `markbook bundle`:
- Default (embed mode): `dist/embed/<slug>.js` — fully self-contained ESM that auto-mounts on `<div data-markbook-embed="<slug>">` placeholders. No iframe.
- `--mode package`: `dist/packages/<slug>/` — a publishable npm package directory with the framework as a peer dep (declared in each adapter's `packagePeerDeps`).
- `--isolation=shadow`: each mount runs inside an open shadow root so host-page CSS doesn't leak in.
- Slugs default to a kebab-case version of the story file path relative to `docsDir`. Singleton `:::story` keeps that bare slug; `:::stories` always promotes to `${baseSlug}-${kebab(exportName)}` so adding/removing exports never silently renames an existing embed. Override per-story by adding `id=stable-name` to the directive: `:::story{src=./Foo.stories.tsx id=stable-name}`. Duplicate slugs across the workspace throw a clear error at bundle time.

Stories share global providers (theme, i18n, router, ...) via **decorators** — an array of modules whose default exports wrap every story. Configure on the adapter, e.g. `reactAdapter({ decorators: ['./theme.tsx', './i18n.tsx'] })`. Decorators apply outer-to-inner, so the first array element becomes the outermost wrapper. The same decorator stack is inlined into embed and package mode bundles, so portable stories render identically out of context. WC stories don't have decorators (vanilla custom elements use a different composition model).

**Theming.** Each rendered page declares dark/light via `<html data-theme>`, set by an inline `<head>` script that reads `localStorage['markbook-theme']` first, falls back to `prefers-color-scheme`, and listens for clicks on `[data-markbook-theme-toggle]` to flip + persist. The colour palette is exposed entirely as `--mb-*` CSS variables (e.g. `--mb-bg`, `--mb-fg`, `--mb-accent`, `--mb-border`); a consumer can override theming by writing a small CSS file that sets these on `:root` (or scoped under `[data-theme="brand"]`). Code blocks use Shiki's dual-theme output (`themes: { light, dark }`, `defaultColor: false`) so syntax-highlighting follows `data-theme` without rebuilding.

**Customization.** Three layers, in order of escalation:
1. `css: string | string[]` in `markbook.config.ts` — paths to CSS files inlined into every page **after** the built-in stylesheet, so `:root { --mb-accent: ... }` rules win. Drop in Tailwind output (run `tailwindcss -i ... -o tailwind.css` and list it here), Open Props, or hand-rolled brand styles. Watched by `markbook dev` — edits trigger a full reload.
2. `disableBaseCss: true` — opts out of Markbook's chrome stylesheet entirely. The placeholder classes (`.markbook-*`) and `data-*` attributes (`data-markbook-story`, `data-markbook-embed`, `data-pagefind-body`, `data-markbook-theme-toggle`, ...) stay stable as the public DOM contract; you ship every rule.
3. `transformHtml(html, page)` — async post-processor that runs after HTML generation and before write. Receives `{ relPath, htmlRelPath, title, frontmatter }`. Use when CSS isn't enough (rewriting header markup, injecting analytics, restructuring nav).

**Stories** can use any styling tool Vite supports — they're built through the project's Vite pipeline. CSS modules (`Variants.module.css` next to `Variants.stories.tsx`) work out of the box. Tailwind / PostCSS plugins / Lightning CSS are auto-detected: Markbook sets `css.postcss: <project-root>` on every Vite config, so a `postcss.config.{js,cjs,mjs}` (or `tailwind.config.*`) at the project root is picked up by all four build modes (build, dev, embed, package). Runtime CSS-in-JS (Griffel, vanilla-extract, emotion, ...) requires no Markbook config.

A story file may also export `args`, `argTypes`, and `parameters`:
- `parameters` — display options for the placeholder element. `{ layout?: 'centered' | 'fullscreen' | 'padded'; background?: string }`. All adapters honour them.
- `args` — initial prop values. The default export becomes a render function `(args) => …`. React + Vue adapters honour them; WC does not pass them through to function stories.
- `argTypes` — optional control-type metadata for each arg: `{ control: 'text' | 'number' | 'boolean' | 'select'; options?: [...] }`. If omitted, types are inferred from runtime values (boolean → checkbox, number → number input, else text).
- React's adapter exposes a `setupControls(controlsEl, args, argTypes, onChange)` helper, and `markbook build` / `markbook dev` wire up an interactive controls panel under every story whose source exports `args`. Changing a control re-mounts with new props (state preserved through React reconciliation).

In `:::stories` files each named export may be a CSF v3 object — `{ render, args?, argTypes?, parameters?, name? }` — and the adapter's entry generator reads `args`/`argTypes`/`parameters` off the export itself, falling back to module-level exports only when the export is a plain function.

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

## Public API

`@markbook/core` ships two entry points:

- **`@markbook/core`** — the stable public surface: `defineConfig`, `build`, `dev`, `bundleEmbed`, plus the matching types (`MarkbookConfig`, `MarkbookAdapter`, `BundleEmbedOptions`, `BundleMode`, `BundleIsolation`). Treat these as semver-stable from v1.0 on.
- **`@markbook/core/internal`** — everything else (parser, code/props extractors, template engine, exports discovery, nav helpers, slugify, cache invalidators). Public enough to write tools against but not stability-guaranteed; signatures may change in minor releases.

Tests in `packages/core/src/*.test.ts` import directly from sibling source modules (`./parse.js`, `./code.js`, etc.) — not via the barrel — so the API split has no test cost.

## Repo layout

```
packages/
  core/             — parser, builder, dev server, embed bundler (framework-agnostic)
  cli/              — `markbook` binary
  adapter-react/    — React mount adapter (+ decorators + controls)
  adapter-vue/      — Vue 3 mount adapter (+ decorators)
  adapter-wc/       — Web components mount adapter (no framework runtime)
examples/
  react-demo/       — Pixie component library — the canonical dogfood
  vue-demo/         — Counter component in Vue
  wc-demo/          — <click-counter> custom element
  embed-host/       — external consumer of the React demo's embed bundles
```

## Commands

- `pnpm install` — install workspace
- `pnpm build` — build all packages
- `pnpm test` — run `@markbook/core` Vitest suite (parse, template, code, build helpers, embed slug, exports discovery)
- `pnpm typecheck` — type-check all packages
- `pnpm lint` / `pnpm lint:fix` — biome
- `pnpm example:build` / `pnpm example:dev` / `pnpm example:bundle` — React demo
- `pnpm example:vue:build` / `pnpm example:vue:dev` / `pnpm example:vue:bundle`
- `pnpm example:wc:build` / `pnpm example:wc:dev` / `pnpm example:wc:bundle`
- `pnpm example:embed-host:serve` — serve embed-host at `http://localhost:4500/embed-host/`

## Style

- TypeScript everywhere. ESM only. Node ≥ 20.
- No comments unless the *why* is non-obvious. Identifiers should explain *what*.
- Prefer editing existing files over creating new ones.
