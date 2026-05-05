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

---

## ADR-0012 — Embed mode: one Vite library build per story, fully self-contained ESM

**Context:** ADR-0006 committed to two output modes for portable stories. v0.5 ships the **embed mode**: bundling each story into a single ESM module that auto-mounts on `<div data-markbook-embed="<slug>">` placeholders in any host page, no iframe required. Open questions: how to identify each story stably; how to bundle; what to bundle vs. externalise; how to demo it.

**Decision:**

- **Stable slugs from file paths.** Each story's slug is derived from the story file's path relative to `docsDir`, with `.stories.{tsx,ts,jsx,js}` stripped, slashes/non-alphanumerics → `-`, lowercased — so `components/Button/Variants.stories.tsx` → `components-button-variants`. The slug is what consumers reference via `data-markbook-embed` and what shows up as the file name in `dist/embed/<slug>.js`. (Future: frontmatter `id:` override for rename-resistance — see ROADMAP v0.5.1.)
- **One Vite library build per story**, not multi-entry. Each story's import graph is independent (different framework runtime use, different transitive deps), and lib mode is per-entry. We loop and call `viteBuild` N times. Slow on large libraries (~1–2 s per story) but trivially correct; future optimisation can switch to a single multi-entry Rollup build.
- **No externals — bundle everything.** `rollupOptions.external = () => false` puts the framework runtime, `@markbook/adapter-X` `mount`, the user's `wrapperModule`, and the story itself into one ESM file. The promise of embed mode is "drop in `<script type="module">`, get a working component" — externals would defeat that. Resulting sizes match the framework cost: Pixie/React stories ~200 KB minified, Vue ~100 KB, web components ~1.5 KB.
- **Force production React.** `define: { 'process.env.NODE_ENV': '"production"' }` + explicit `minify: 'esbuild'` strip React's dev branches and the development bundle (744 KB → 202 KB per Pixie story, observed). Without this Vite picks up the user's project root and React's UMD entry includes both prod and dev code.
- **Auto-generated sandbox.** `dist/embed/index.html` lists every bundled story as a `<div data-markbook-embed>` + `<script type="module">` pair so the user gets a working demo of every embed without writing a host page.

**Consequences:** Embed mode works today across all three adapters with the same code path — proving the adapter contract (`packageName` + `mount`) is sufficient. The bundling cost (1–2 s × N stories) becomes a 30–40 s build for the 19-story Pixie demo; acceptable now, switch to multi-entry Rollup if it bites at 100+ stories. Slugs derived from path are stable across rebuilds but break if files move — v0.5.1's frontmatter `id:` override fixes that. CSS auto-injection isn't done yet; stories that import CSS will get a sibling `dist/embed/<slug>.css` and need the host page to link it manually until v0.5.1.

---

## ADR-0013 — Package mode, shadow isolation, and slug overrides

**Context:** v0.5 shipped embed mode. The remaining ADR-0006 pieces — package mode, shadow-DOM isolation, slug overrides — share two cross-cutting concerns: how the bundler decides what's external (per-adapter peer deps), and how the adapter's `mount` accepts the same `opts` shape across React/Vue/WC.

**Decision:**

- **Adapter declares its peer deps.** New optional `MarkbookAdapter.packagePeerDeps: string[]` field. React adapter sets `['react', 'react-dom']`, Vue sets `['vue']`, WC sets `[]`. `bundleEmbed`'s package-mode build passes this directly to `rollupOptions.external`. Embed mode ignores `packagePeerDeps` (always inlines everything) — the two modes' externals lists are intentionally different.
- **Shared `MountOptions` shape across adapters.** Each adapter's `mount` independently accepts `{ wrapper?, isolation? }` — the values are typed per adapter (React's `wrapper` is a `ComponentType`, Vue's would be a Vue component, etc.) but the field names are stable. `embed.ts` builds the opts literal once via `buildMountOptsLiteral` and emits it for every adapter; adapters that don't implement a given field ignore it. `resolveMountTarget(el, opts)` is duplicated in each adapter (~5 lines) — small enough to not justify a shared utility package.
- **Slug precedence: directive `id=` > derived from file path.** `parseMarkdown` parses the `id` attribute into `StoryRef.slug`. `bundleEmbed` uses `story.slug ?? slugify(docsRel)`. The slug is what shows up as the bundle file name, the `data-markbook-embed` value, and (in package mode) the `package.json` `name` (with optional `MarkbookConfig.bundle.packageScope` prefix).
- **Two entry generators, one shared import builder.** `generateEmbedEntry` ends with `for (const el of querySelectorAll(...)) mount(el, Story, opts)` — auto-mounting. `generatePackageEntry` exports `mount(el, opts)` and `story` plus a default; consumers call `mount(...)` themselves. Both use a shared `buildEntryImports` so the import lines (adapter, optional wrapper, story default-vs-named) stay consistent.
- **Shadow root strategy.** For React/Vue we mount inside a `<div class="markbook-shadow-host">` *child* of the shadow root (because `createRoot(shadowRoot)` and `app.mount(shadowRoot)` both need an element, not a `ShadowRoot`). For WC the shadow root itself is the target since `innerHTML`/`appendChild` work on `ShadowRoot`. Mode is `'open'` so devtools can still inspect.

**Consequences:** Each new adapter now has three things to declare: `packageName`, `vitePlugins` (optional), `packagePeerDeps` (optional). The `mount` contract picks up `isolation` for free if the adapter calls a copy-pasted `resolveMountTarget`. Package-mode bundles dropped from ~200 KB (embed-mode React) to ~3.5 KB (just adapter + story + wrapper, externalising React) — proving the externals strategy works. `--mode package` doesn't generate a sandbox HTML (vs embed mode) because the consumer mounts manually; the README explains the API instead. **Open**: CSS handling for stories that import `.css` files is still manual — the bundler will emit a sibling `<slug>.css` but the consumer must link it; auto-inject is a future enhancement.

---

## ADR-0014 — Decorator arrays replace the single wrapper, outer-to-inner

**Context:** ADR-0005 split the React adapter so the user could pass a single `wrapper` module (e.g. `FluentProvider`). Real libraries stack multiple providers — theme, i18n, router, analytics — and need control over their order. The single-slot API forced users to nest manually in one file, hiding the ordering and making composition awkward. We need a Storybook-style `decorators[]` API that scales.

**Decision:**

- **Rename `MarkbookAdapter.wrapperModule?: string` → `decoratorModules?: string[]`.** The renaming is a clean break (no published packages); we don't keep a back-compat alias. Users with the old API change one line: `wrapper: './x'` → `decorators: ['./x']`.
- **Outer-to-inner ordering.** `decorators: [A, B]` produces `<A><B><Story /></B></A>`. Implementations iterate the array in reverse and wrap as they go — the last entry wraps the story first (innermost), each previous entry wraps that result. Reads naturally: list outermost first.
- **Per-adapter implementation, shared opt name.** Each adapter's `mount(el, story, opts)` accepts `opts.decorators?: ComponentType<{children}>[]` (React) or `Component[]` (Vue). Web components don't get decorators in v0.6 — `<slot>`-based composition exists but the typical use case (theme providers) doesn't have a clean WC mapping; revisit if needed.
- **One generation path for all four modes.** Regular `build`, `dev`, `embed`, and `package` all generate the same shape: import each decorator once, pass them as a literal array to `mount`. The shared `buildEntryImports` helper in `embed.ts` returns `decoratorRefs: string[]`; `build.ts`'s `generateEntry` does the same. This guarantees portable bundles render identically to the in-Markbook page — they share the decorator stack.

**Consequences:** Adding a global provider is one line per layer. Order is explicit and the array becomes a public API contract — adding new providers in the middle of the stack changes the rendered tree, so users should think about ordering. Decorators are *adapter-specific components* (a React decorator can't be used as a Vue decorator), but the option *name* is shared, so docs and CLI flags don't fork per adapter. Vue's `wrapWithDecorators` builds a `defineComponent` wrapping tree using `h(Decorator, null, { default: () => child })` — Vue decorators must accept a default slot, just as React decorators must accept `children`. The same per-adapter story-portability constraint as ADR-0011 applies: a Vue decorator can't be hoisted into a React project.

---

## ADR-0015 — Args, argTypes, and parameters live as story exports; controls run at runtime

**Context:** v0.7 adds per-story `parameters` (layout/background), `args` (initial props), and interactive controls. Two design questions: where do these live in the user's story file, and how does the build pipeline learn about them?

**Decision:**

- **Story-as-module convention.** A story file remains "one story per file with `export default`" — but may now also export `args`, `argTypes`, and `parameters` as plain values. This piggybacks on the existing convention (no new file types, no new decorators, no metadata sidecar). Vite/Rollup pick them up as named exports.
- **Runtime detection, not build-time AST parsing.** The entry generator switches from `import default` to `import * as ns` and reads `ns.args`, `ns.argTypes`, `ns.parameters` at runtime in the generated entry script. No TypeScript compiler API parsing for these (unlike v0.1's story-source extraction, which still uses TS API). Rollup warns about `MISSING_EXPORT` for optional fields — silenced via `onwarn` in build / embed / package configs since the access is intentional.
- **Controls UI is browser-side, adapter-owned.** `setupControls(controlsEl, args, argTypes, onChange)` lives in `@markbook/adapter-react`. The entry generator emits the wiring; the helper builds the form DOM, listens for `input` / `change`, mutates `args` in place, and calls `onChange` to trigger a re-mount. Mutating in place plus a stable callback (closure over `args`) means React's reconciliation diffs props without remounting the story — state preserved.
- **Controls placeholder is always emitted.** Every story-block now contains a `<div class="markbook-controls" data-markbook-controls="<id>">`. CSS `:empty { display: none }` hides it when a story doesn't export `args`. No build-time branching by story.
- **Adapter declares capability.** `MarkbookAdapter.hasControls?: boolean` controls whether the entry generator imports `setupControls` and emits the wiring. React: `true`. Vue / WC: not yet — Vue could honour it (v0.7 has args support, just not the controls UI); WC's slot model would fight the form.

**Consequences:** Existing stories work unchanged — they don't export `args`, the controls placeholder is hidden by CSS. Adding controls to a story is purely additive. The entry generator stays simple — it doesn't need a TS-AST step for the new features. The runtime cost is small: a few extra namespace imports + a `setupControls` call per story-with-args. Embed and package bundles also pick up `args` / `parameters` for free (the namespace import propagates), so portable stories render with the right initial props out of context — though the embed mode doesn't include controls UI (no host-page placeholder). Package mode exports `args` / `argTypes` / `parameters` from the published index so a consumer who wants controls can wire their own UI to the package's `mount(el, opts)`.

---

## ADR-0016 — Dark mode via `[data-theme]` + CSS custom properties + Shiki dual output

**Context:** Markbook needs a dark mode that doesn't fork the build, doesn't flash on first paint, and lets consumers override the palette without rebuilding the CSS. Shiki bakes colours into HTML at build time, so the naive approach (one theme string at build) doesn't allow runtime switching.

**Decision:**

- **Token surface = `--mb-*` CSS variables.** Already in place since the Starlight refresh. v0.8 adds an `[data-theme="dark"]` ruleset that overrides each variable; everything in the chrome (header / sidebar / story / controls / search / props table / TOC) reads from variables, so flipping `data-theme` repaints without touching markup. Both rulesets set `color-scheme` so native form widgets (Pagefind UI input, controls panel inputs) follow the theme.
- **Shiki dual output.** `code.ts` calls `codeToHtml(code, { themes: { light, dark }, defaultColor: false })`. The HTML carries `--shiki-light` / `--shiki-dark` on each token; a single CSS rule pair selects the right colour based on `[data-theme]`. No rebuild on toggle; the JS bundle stays the same shape.
- **Inline boot script in `<head>`, before `<style>`.** Runs synchronously and sets `document.documentElement.dataset.theme` from `localStorage` (or `prefers-color-scheme` on first visit) before paint, eliminating FOUC. The same script delegates click handling on `[data-markbook-theme-toggle]` from `document`, so the toggle button can appear anywhere in the page (or be added later by user CSS) and still work.
- **Theme is the consumer's override point.** The `--mb-*` tokens are documented as the public theming API. A consumer who wants their own brand can ship a small `theme.css` redefining `:root` (or scoping under a custom `[data-theme="brand"]`) — no fork of `BASE_CSS` needed.

**Consequences:** Dark mode shipped without a JS framework or theme provider — pure CSS variables + a 600-byte boot script. The Shiki dual-theme output is slightly larger than single-theme (~10–15% growth from extra custom properties on every span) — acceptable for the flexibility. The `color-mix(in srgb, var(--mb-accent) 22%, transparent)` rule on the search highlight requires Chrome 111+ / Firefox 113+ / Safari 16.2+ (March 2023+); for older browsers the highlight loses its accent tint but stays legible. Future themes (e.g. high-contrast, sepia) plug in by adding more `[data-theme="..."]` rulesets — no schema or parser change required.
