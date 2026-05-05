# Architecture decisions

Short ADR-style records of non-obvious choices. Each entry: **Context** (the problem), **Decision** (what we chose), **Consequences** (what this implies, good and bad).

---

## ADR-0001 — Markdown directives instead of MDX

**Context:** Markbook embeds component stories inside markdown documentation. MDX is the obvious choice for "JS in markdown," but it conflates markdown with JSX, makes plain-text extraction (for `llms.txt`) hard, and effectively ties the renderer to React.

**Decision:** Use plain CommonMark + `remark-directive`. Stories are embedded with a container directive: `:::story{src=./Button.stories.tsx export=Primary}`.

**Consequences:** Markdown stays markdown; `llms.txt` falls out for free; framework adapters can mount any component runtime in the placeholder element. Authors lose MDX's expressivity (e.g., inline JSX), but that is intentional — Markbook is docs-first.

---

## ADR-0002 — Vite as the build backbone

**Context:** Need to bundle `.tsx` / `.js` story files plus their dependencies into static assets and provide a dev server with HMR.

**Decision:** Use Vite via its programmatic API for both `markbook build` and (later) `markbook dev`. Each markdown page becomes a Vite multi-page-app input.

**Consequences:** Inherits Vite's plugin ecosystem (React, Vue, etc. already solved). Adds a non-trivial dependency, but rolling our own esbuild pipeline would reinvent HMR, CSS handling, and the asset graph for little gain.

---

## ADR-0003 — Adapter pattern for framework support

**Context:** Markbook must work with React, Vue, web components, and any other component runtime without baking framework code into core.

**Decision:** Core mounts story placeholders by emitting `<div data-markbook-story="...">` elements and a per-page entry script. The entry script imports the named story export and a `mount(el, story)` function from a user-chosen adapter package (e.g. `@markbook/adapter-react`).

**Consequences:** Core stays framework-agnostic. Each adapter package is small (~one function plus the relevant Vite plugin). Users pick the adapter in `markbook.config.ts`.

---

## ADR-0004 — Pagefind for search

**Context:** Need full-text search across the built site without a server.

**Decision:** Run Pagefind against `dist/` after the Vite build. Inject the Pagefind UI into the page shell.

**Consequences:** Zero search-index logic in core. Adds a binary dependency. Switch to MiniSearch if the binary footprint becomes a problem.

---

## ADR-0005 — Adapter packages have separate browser and config entry points

**Context:** During the v0.1 smoke milestone the example build failed because `@markbook/adapter-react` exported both the browser-side `mount(el, story)` runtime and the Node-side `reactAdapter()` config helper from a single entry. The generated entry script imported `mount` from the package root, which transitively pulled in `@vitejs/plugin-react` → Vite → Babel → Node built-ins, and Vite then tried to bundle that whole tree into the browser bundle.

**Decision:** Every adapter package exposes two entry points via `package.json` `exports`: the default (`@markbook/adapter-X`) for the browser-side runtime (`mount`), and `@markbook/adapter-X/config` for the Node-side `Xadapter()` config helper. Users import the config helper in `markbook.config.ts`; core's generated entries only ever import the default.

**Consequences:** No Node-only dependencies leak into browser bundles. Slight authoring cost — users have to remember to import `reactAdapter` from `@markbook/adapter-react/config` rather than the package root. Future Vue and web-components adapters must follow the same convention.

---

## ADR-0006 — Story portability: embeddable bundles and stories-as-packages

**Context:** Stories should be reusable on external pages (marketing sites, other docs, blog posts) without iframes. The user also asked for "stories as packages" — install a story like an npm dep.

**Decision:** Markbook will support two output modes for portable stories, both generated from the same per-story bundling pipeline (target: v0.5 — see `ROADMAP.md`):

1. **Embed mode** — `markbook bundle <story-id>` emits `dist/embed/<story-id>.{js,css}`. The JS is a self-contained ESM module (framework runtime + adapter `mount` + the user's `wrapper` from ADR-0005 split + the story + transitive deps) that auto-mounts on load by querying for `<div data-markbook-embed="<story-id>">`. Embedding into a host page is `<script type="module" src="...">` plus the placeholder div — no iframe.
2. **Package mode** — `markbook bundle <story-id> --mode package` emits a publishable npm package directory under `dist/packages/<story-id>/` with its own `package.json`, a `dist/index.js` exporting `mount(el, opts?)`, and (for React stories) a `<MountStory />` convenience export. The framework runtime is declared as a peer dep so the consumer's app shares its React (or Vue, etc.) instance.

Both modes share:

- **Pipeline**: a Rollup or Vite library build keyed on the story's resolved import graph. Reuses the wrapper module from `markbook.config.ts` so the embedded story renders identically to the in-Markbook story.
- **Isolation**: optional `--isolation=shadow` flag wraps the mount in a shadow root, preventing host-page CSS from leaking in (and our styles from leaking out).
- **CSS**: extracted to a sibling `.css` file when the story uses any (Fluent's runtime CSS-in-JS already inlines; static CSS imports get extracted).

**Consequences:** Adds a non-trivial second build pipeline alongside the static-site build. The adapter's `mount` API becomes the central reuse point — embed/package output is essentially a thin wrapper around it; we commit to keeping `mount(el, story, opts)` stable. Story IDs (currently auto-generated as `<fileId>--<index>`) become user-visible identifiers and must become stable across rebuilds, ideally remappable via frontmatter (e.g. `id: button-primary`). The wrapper-module convention from ADR-0005 is what makes embedding "render identically" work.

---

## ADR-0007 — Story code via TS compiler API, props table via react-docgen-typescript

**Context:** Two adjacent build-time analyses on user TypeScript files: (a) extract the source of a single named export from a `.stories.tsx` file (so we can show "Show code" under the rendered story and embed it in `llms.txt`); (b) extract a typed props table for a component (so each page can render a Storybook-style argstable). Both are fundamentally TS-AST jobs.

**Decision:** Use **TypeScript's compiler API** (`ts.createSourceFile`, `ts.isVariableStatement`, etc.) for story-source extraction — narrow, fast, no extra deps because we already had `typescript`. Use **`react-docgen-typescript`** for the props table — a mature library that already handles JSDoc, default values, enum literal extraction, and respects the user's `tsconfig.json` (we walk up from the project root to find it). Cache the parser per `tsConfigPath`. The props table is rendered into both HTML (`<table class="markbook-props">`) and markdown (`| Name | Type | Default | Description |`) at build time.

**Consequences:** Core gains two build-time deps that are **fine**: TS compiler is already required transitively by `react-docgen-typescript`, and we promote it from devDep to dep. No browser cost — both analyses run only during `markbook build` / `markbook dev`. The props table is opt-in via the `:::props` directive — pages without it don't pay any analysis cost. **A real constraint surfaces:** props extraction requires the component's TypeScript source to live in the same repo as the docs (or be reachable via the `tsconfig.json`). External component libraries (e.g. an installed `@fluentui/react-components`) ship `.d.ts` typings that work, but JSDoc descriptions and default values are usually absent on bundled `.d.ts` — so the props table feature is most useful when documenting an in-repo lib. This is what forced the `examples/react-demo` revert from Fluent to the in-repo `Pixie` lib.

---

## ADR-0008 — Page templates as text substitution, opt-in via frontmatter

**Context:** With 5+ component pages all sharing the same skeleton (H1, description-as-lede, `## Props` + `:::props`, then story sections), every structural change had to be applied to every page. We need a template mechanism that's powerful enough to factor out that skeleton but doesn't fight the "markdown is the source of truth" principle (ADR-0001) or require a templating-engine dependency.

**Decision:** Templates are **plain markdown files** in `<root>/templates/<name>.md`. A page opts in by setting `template: <name>` in its frontmatter; the template body is loaded, its own frontmatter (if any) is stripped, and tokens of the form `{{ key }}` are substituted from the page's frontmatter. Reserved tokens: `{{ content }}` (the page's raw markdown body) and `{{ frontmatter.x.y }}` (arbitrary dot-path access). The substituted result is then handed to the existing remark pipeline. **No conditionals, no loops, no expressions** — substitution only. Templates can include any markdown, HTML, or directive (`:::props`, `:::story`); directives are resolved against the **page's** frontmatter and base directory.

**Consequences:** Cheap to implement (~50 LOC in `template.ts`), zero new runtime deps. Pages without `template:` are unaffected — full backwards compatibility. Story directive `src` paths still resolve relative to the page (not the template), which means stories must live in the page body, not the template — that's a feature, not a limitation: stories are page-specific. **The KISS choice is deliberate**: any expressive feature added later (conditionals, loops, partials) needs to justify its complexity against alternatives at a different layer (e.g., a `:::stories{src=…}` directive that auto-lists every export from a stories file would solve the most common loop case without templates needing logic).

---

## ADR-0009 — Pagefind for search, with its own bundled UI

**Context:** ADR-0004 committed to Pagefind for static-site search. Implementation choices: use Pagefind's CLI vs. its Node API; use the bundled UI from the `pagefind` npm package vs. the separate `@pagefind/default-ui` / `@pagefind/modular-ui` packages; index the entire page or just the article.

**Decision:** Use the **Node API** (`import * as pagefind from 'pagefind'` → `createIndex` / `addDirectory` / `writeFiles`) so we don't shell out and can surface errors as exceptions. Use the **bundled UI** that `writeFiles` already emits (`pagefind-ui.{js,css}` land alongside the index in `dist/pagefind/`) — no extra UI dep. Restrict indexing to the article via `data-pagefind-body` on `<article class="markbook-content">` so the nav, header, and TOC don't pollute search hits. Pagefind UI is themed via Pagefind's documented `--pagefind-ui-*` CSS variables, mapped to Markbook's existing `--mb-*` tokens.

**Consequences:** One added dep (`pagefind`, ~5 MB including the WASM tokenizer); zero browser-side cost beyond the UI bundle (~120 KB JS + 14 KB CSS, served only from `pagefind/`). The UI lives in the header next to the brand and uses relative URLs (`./pagefind/…` or `../pagefind/…`) so the site can be served from any subpath. Vite emits two warnings during build (the `<script src="pagefind/pagefind-ui.js">` is non-module and the CSS doesn't exist at build time) — both are *expected*, since Pagefind writes those files **after** Vite finishes; Vite passes the references through unchanged, which is what we want. Indexing only `data-pagefind-body` means search hits are page-content only — if a future feature needs broader indexing (e.g. nav search), revisit.

---

## ADR-0010 — Two file watchers in dev: Vite owns the module graph, chokidar owns user content

**Context:** `markbook dev` needs to react to two distinct kinds of file changes: (a) the *module graph* — story `.tsx` files, component `.tsx`, `.css` imports, etc., which want React Fast Refresh / HMR; and (b) *user content* — `.md` pages, template `.md` files — which need Markbook's pipeline to regenerate the entry/HTML files in tmpDir before Vite can react. Vite's bundled chokidar (`server.watcher`) ignores files outside its `root`, and the Markbook root for the dev server is `tmpDir` (sibling to `docsDir`), so it doesn't see user content edits.

**Decision:** Run two watchers with non-overlapping concerns: **Vite's `server.watcher`** continues to watch tmpDir (where the generated entry/HTML files live) and any `.tsx`/`.ts`/`.css` files those entries import — Vite handles HMR for the module graph automatically via `@vitejs/plugin-react`. **A dedicated chokidar instance** (now a core dep) watches `docsDir` and every entry of `templatesDir`. On `.md` change/add/unlink it calls `writePages` to regenerate the affected files in tmpDir and broadcasts `{ type: 'full-reload' }` over Vite's WebSocket so the browser refreshes.

**Consequences:** Adds `chokidar@^4` as an explicit dep (it was already a transitive dep via Vite). Clear separation: Vite never tries to interpret `.md` and Markbook never tries to HMR a story file. The current regeneration is **all-pages**: any `.md` edit re-parses every page (Shiki, react-docgen-typescript) — fine for the 6-page demo (~800ms), but a 50-page library will need per-file caching keyed on mtime. Slated for v0.4 polish. The `searchEnabled` flag threaded through `writePages` → `generateHtml` is what keeps the dev HTML clean: no Pagefind UI markup, no link/script tags, no 404s — search is a build-time-only feature by design.

---

## ADR-0011 — Adapter conventions: one demo per adapter, no per-adapter core logic

**Context:** v0.4 adds Vue and web-components adapters. The question: how much of `@markbook/core` needs to know which adapter is in use? And how do we structure demos when each Markbook site picks exactly one adapter via `markbook.config.ts`?

**Decision:** Core stays adapter-agnostic — it imports nothing from any adapter. The contract is the `MarkbookAdapter` shape (`packageName`, optional `vitePlugins`, optional `wrapperModule`); each adapter package returns its own instance from a factory in `./config`. Core's generated entry just does `import { mount } from '<adapter.packageName>'` plus the framework-agnostic `mount(el, story, opts?)` call. **One demo workspace per adapter** (`examples/react-demo`, `examples/vue-demo`, `examples/wc-demo`) — there is no multi-adapter demo because there is no multi-adapter site; the adapter is a project-level choice. Each demo dogfoods exactly one adapter and stays small enough that breaking changes to the adapter contract surface immediately. Story file extensions match the adapter's idiom (`.stories.tsx` for React, `.stories.ts` for Vue and WC); the directive doesn't care. Shiki's `lang` adapts to the file extension so highlighting stays accurate.

**Consequences:** Adding a new adapter is mechanical: one package (`./` mount + `./config` factory + Vite plugin if needed) plus one demo. Three things stay React-only for now — props tables (react-docgen-typescript), the `wrapper` option (only adapter-react implements `MarkbookAdapter.wrapperModule`), and the lede description selector (`.markbook-content > h1 + p`, framework-independent so this is fine). Generalising props tables means swapping in the right docgen tool per adapter (vue-docgen-api for Vue, custom-elements-manifest analyzer for WC). Generalising wrappers means making each adapter's `mount` honour `opts.wrapper` consistently — Vue can do this with a default slot, WC needs a chosen pattern (e.g. wrap inside a fixed parent element). Both are slated for v0.5 (where story-portability *requires* the wrapper to render identically out of context).
