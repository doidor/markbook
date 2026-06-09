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

**Decision:** Core mounts story placeholders by emitting `<div data-markbook-story="...">` elements and a per-page entry script. The entry script imports the named story export and a `mount(el, story)` function from a user-chosen adapter package (e.g. `@doidor/markbook-adapter-react`).

**Consequences:** Core stays framework-agnostic. Each adapter package is small (~one function plus the relevant Vite plugin). Users pick the adapter in `markbook.config.ts`.

---

## ADR-0004 — Pagefind for search

**Context:** Need full-text search across the built site without a server.

**Decision:** Run Pagefind against `dist/` after the Vite build. Inject the Pagefind UI into the page shell.

**Consequences:** Zero search-index logic in core. Adds a binary dependency. Switch to MiniSearch if the binary footprint becomes a problem.

---

## ADR-0005 — Adapter packages have separate browser and config entry points

**Context:** During the v0.1 smoke milestone the example build failed because `@doidor/markbook-adapter-react` exported both the browser-side `mount(el, story)` runtime and the Node-side `reactAdapter()` config helper from a single entry. The generated entry script imported `mount` from the package root, which transitively pulled in `@vitejs/plugin-react` → Vite → Babel → Node built-ins, and Vite then tried to bundle that whole tree into the browser bundle.

**Decision:** Every adapter package exposes two entry points via `package.json` `exports`: the default (`@markbook/adapter-X`) for the browser-side runtime (`mount`), and `@markbook/adapter-X/config` for the Node-side `Xadapter()` config helper. Users import the config helper in `markbook.config.ts`; core's generated entries only ever import the default.

**Consequences:** No Node-only dependencies leak into browser bundles. Slight authoring cost — users have to remember to import `reactAdapter` from `@doidor/markbook-adapter-react/config` rather than the package root. Future Vue and web-components adapters must follow the same convention.

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

**Context:** v0.4 adds Vue and web-components adapters. The question: how much of `@doidor/markbook-core` needs to know which adapter is in use? And how do we structure demos when each Markbook site picks exactly one adapter via `markbook.config.ts`?

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
- **Controls UI is browser-side, adapter-owned.** `setupControls(controlsEl, args, argTypes, onChange)` lives in `@doidor/markbook-adapter-react`. The entry generator emits the wiring; the helper builds the form DOM, listens for `input` / `change`, mutates `args` in place, and calls `onChange` to trigger a re-mount. Mutating in place plus a stable callback (closure over `args`) means React's reconciliation diffs props without remounting the story — state preserved.
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

---

## ADR-0017 — Three-layer customization, with PostCSS auto-detection for stories

**Context:** Before the v1.0 freeze the user wanted Markbook to be "extremely customizable" for both chrome (CSS or Tailwind, with the freedom to restructure HTML) and stories (CSS modules, Tailwind, Griffel, vanilla-extract — anything Vite can chew). The challenge: don't ship a hundred config knobs, don't fork a stylesheet, don't grow a per-tool integration matrix. Identify the smallest API that covers the spectrum without competing with itself.

**Decision:**

- **Three escalating chrome layers, all opt-in.**
  1. `css?: string | string[]` — paths inlined into every page as a `<style data-markbook-user-css>` block **after** the built-in CSS, so token overrides (`:root { --mb-accent: ... }`) win without `!important`. This handles 95% of real-world theming: brand colour swaps, Tailwind output (run `tailwindcss -i src.css -o dist.css` then list `dist.css`), font tweaks, hover state polish.
  2. `disableBaseCss?: boolean` — opts out of `BASE_CSS` entirely. The DOM contract (placeholder classes `.markbook-*` and `data-*` attributes like `data-markbook-story`, `data-markbook-embed`, `data-pagefind-body`, `data-markbook-theme-toggle`) is preserved as the public surface; users ship every rule. This is the "I want to write the whole stylesheet" escape hatch.
  3. `transformHtml?(html, page) => string | Promise<string>` — async post-processor invoked between `generateHtml` and write. Receives `{ relPath, htmlRelPath, title, frontmatter }`. Use when CSS can't reach (rewrite header markup, swap nav structure, inject `<script>`s). The `page` object is intentionally minimal — adding fields later is forward-compatible.
- **Watcher integration.** `cssPaths` is part of `BuildContext`; the chokidar watcher in `dev` watches every entry. On change it re-reads + concatenates `userCss`, regenerates HTML, and broadcasts `full-reload` — same path as `.md` edits. (HMR for `<style>` blocks would require fishing them out of the page rather than re-emitting whole HTML; full-reload is correct and simpler.)
- **PostCSS auto-detection for stories.** Every Vite invocation (`build.ts`'s `viteBuild`, `dev`'s `createServer`, `embed.ts`'s embed and package builds) sets `css: { postcss: ctx.root }`. Without this, Vite searches relative to its `root` (which is `tmpDir`, not the user's project) and never finds `postcss.config.*`. With it, every story build picks up the project's PostCSS pipeline automatically — Tailwind, Lightning CSS, autoprefixer, nesting plugins, all "just work". No `tailwind: true` flag, no Markbook-specific Tailwind config schema; PostCSS discovery is the abstraction.
- **CSS Modules need no plumbing.** Vite handles `*.module.css` natively. Stories that want scoped class names just import a sibling `.module.css`. Validated with `examples/react-demo/docs/components/Button/Variants.module.css` — the imported `styles.row` ends up as a hashed class (`_row_<hash>_2`) in the bundle.
- **Runtime CSS-in-JS is out of scope.** Griffel, vanilla-extract, emotion, and friends do their work at mount time inside the user's component tree; Markbook never touches them. Confirming this means we don't need a "css-in-js" config field; not having one is the contract.

**Consequences:** The chrome surface is three knobs: `css`, `disableBaseCss`, `transformHtml`. The story surface is zero knobs — every Vite-supported tool works because Vite (and PostCSS, when configured) is in the path. Adding a new chrome customization requires real justification — there's a clear escalation ladder for users to point at when reaching for a fourth knob ("can I do it with `css`? if not, `disableBaseCss`? if not, `transformHtml`?"). The downside: `transformHtml` is a string-in / string-out function — there's no DOM-API affordance — so users reach for `cheerio` or regex. That's a feature: it's framework-agnostic and Markbook never has to ship a DOM parser. **A real constraint surfaces:** `css` only inlines static files; if a user wants their CSS to be *built* (Sass, Stylus, PostCSS-transformed) before inlining, they must run that build themselves and point `css` at the output. Tailwind users are already accustomed to this, so it's the right default; if Sass authoring becomes common we can grow `css` into accepting build-output handlers, but YAGNI for now.

---

## ADR-0018 — `:::stories` is a separate directive (not a `:::story` overload)

**Context:** Markbook's "one story per file with default export" convention works for small libraries but multiplies file count once a component has many variants. The Storybook CSF v3 idiom (one file, many named exports) is the obvious fit. Two designs were possible: (a) overload `:::story` so it fans out when no `export=` is given and the file has multiple named exports; (b) introduce a distinct `:::stories` directive.

**Decision:** Add a distinct `:::stories` directive. `:::story` always renders exactly one story (default or named via `export=`); `:::stories` always fans out to all (or `only=`/`exclude=`-filtered) named exports. Each `:::stories` export is rendered with its own H3 heading, its own placeholder, its own controls slot, and **its own code disclosure showing only that export's slice** of the source (imports + non-export helpers + the named export only — implemented via TS AST in `code.ts`).

CSF-object detection (a named export may be `{ render, args, argTypes, parameters, name }` instead of a plain render function) is enabled in the entry generator for both singleton and fan-out paths. The detector requires `render` AND at least one of `args` / `argTypes` / `parameters` / `name` so Vue's `defineComponent({ render })` and React's `forwardRef` (which both return objects with `render`) are not misclassified.

For `markbook bundle`, fan-out stories always promote their slug to `${baseSlug}-${kebab(exportName)}` (singleton `:::story` keeps the bare slug). Duplicate slugs across the workspace throw at discovery time.

**Consequences:** Two directives are slightly more grammar surface than one but the semantics are unambiguous — a reader knows from the directive name whether to expect one story or many. The slug-always-promote rule means a `:::stories` file with one named export ships as `<path>-<exportname>` instead of `<path>`, which is verbose but bulletproof against future renames. The TS-AST slicer in `code.ts` adds the TypeScript compiler API as a runtime dependency for code disclosure (it was already a dep for export discovery), which keeps Markbook robust against type-only exports, JSDoc preservation, and re-export edge cases that a regex would mangle.

---

## ADR-0019 — Public vs. internal API split (`@doidor/markbook-core` exports map)

**Context:** Before v1.0 every symbol in `@doidor/markbook-core` was re-exported from `index.ts`. Tests imported directly from source modules (`./parse.js`, etc.), but the barrel made `extractStoryCode`, `slugify`, `sortIndexFirst`, and a dozen other internals look like part of the contract. Without a deliberate split, the v1.0 freeze would either lock in too much surface or break advanced consumers who started depending on now-renamed internals.

**Decision:** `package.json` `exports` map has two keys: `.` (stable, semver-guaranteed) and `./internal` (best-effort, may change in minor releases). The main entry exports only `defineConfig`, `build`, `dev`, `bundleEmbed`, and the matching types. The `./internal` entry re-exports parser, code/props extractors, template, exports discovery, nav helpers, slugify, and cache invalidators — anything useful for power tooling but too tied to internal implementation to freeze.

Test files keep importing from sibling source modules (no path change). Cross-package consumers in the workspace (adapter packages, CLI) only use the main entry — verified by grep.

**Consequences:** A user writing a custom CLI around Markbook (e.g. an alternative bundler) can `import { parseMarkdown } from '@doidor/markbook-core/internal'` and accept the contract that the function may grow new options at any minor release. The split also informs README writing — `packages/core/README.md` documents only the main-entry surface, while internals are listed in `internal.ts`'s top-of-file comment for discoverability. Future API audits become a refactoring exercise rather than a breaking change: anything that should have been internal can be moved to `./internal` without bumping major.

---

## ADR-0020 — "Open in playground" buttons via provider POST forms (not SDKs)

**Context:** Storybook ships an "Open in CodeSandbox" button that's been on every Markbook user's wishlist. Two providers are worth supporting: CodeSandbox and StackBlitz. Each has a JavaScript SDK (`@stackblitz/sdk`, no official CodeSandbox SDK that I'm aware of) and an unauthenticated POST form API. The button needs to encode the story's source plus a minimal sandbox project (package.json + index.html + an entry that mounts the story's default export).

**Decision:**
- **No SDK dependency.** Both providers expose stable POST form endpoints (`https://stackblitz.com/run` and `https://codesandbox.io/api/v1/sandboxes/define?json=1`). Markbook builds a hidden form at click time and submits — zero runtime deps, no version churn.
- **Build descriptors at parse time, submit at click time.** `packages/core/src/playground.ts` exports `buildPlaygroundDescriptors({ storyFiles, config, ... })` which returns one `PlaygroundFormDescriptor` per configured provider. Each descriptor carries `{ action, fields: [name, value][] }`. The HTML emitter (in `build.ts`) base64-encodes the descriptor into a `data-payload` attribute on the button.
- **Boot script** (`PLAYGROUND_BOOT_SCRIPT` in `build.ts`, ~280 bytes minified inline) delegates clicks on `[data-markbook-playground]`, decodes the payload, builds a form with `target="_blank"`, submits, removes.
- **Config shape on `MarkbookConfig`:** `playground?: { providers: 'codesandbox' | 'stackblitz' | ['codesandbox','stackblitz']; dependencies?: Record<string, string>; stackblitzTemplate?: string } | false`. Default off; one button per provider; multiple providers ship multiple buttons side by side.
- **React-only for v1.** Sandbox layout uses CRA template (package.json + public/index.html + src/index.tsx + the story file under src/). Vue/WC support is additive (different template + entry shape) and gated behind a future per-adapter `playgroundTemplate` hook.
- **Sandbox payload is the story's source verbatim.** In-repo relative imports stay broken in the sandbox — documented as a known limitation in `.copilot/wiki/playground-imports-stay-broken.md`. Markbook does NOT rewrite imports or copy in-repo source files; doing so would require module-graph traversal and per-project resolution assumptions that would frequently be wrong.

**Consequences:** The feature ships with one new file (`playground.ts`), one config addition, ~280 bytes of inline JS, and a small CSS block. Bundle size impact on the docs site is per-story: a base64-encoded JSON descriptor (~1–3 KB per button per story per provider). For Pixie's 20 stories × 2 providers that adds ~60–80 KB of HTML across all pages — acceptable for the feature value. The "broken imports for in-repo demos" tradeoff is real and surfaces immediately when a Pixie user clicks Open in CodeSandbox; the wiki entry tells them why and how to recover. A future `playground.inlineSourceImports` hook can address that case without rework.

---

## ADR-0021 — Bare-specifier resolution for path-like fields

**Context:** Five places in `MarkbookConfig` / frontmatter / directive attributes take a path-like value: `frontmatter.component` (props table source), `:::story{src=}` and `:::stories{src=}` (story file), `MarkbookAdapter.decoratorModules` (decorator components), and `MarkbookConfig.css` (chrome customization). All of them shipped using `path.resolve(fromDir, spec)`, which silently treats bare specifiers like `@my-org/button` as relative path segments (`/page/dir/@my-org/button`). The downstream code then fails to find the file and produces invisible degradation — for `:::props` this means the table renders as an HTML comment with no error in the terminal.

Real-world Markbook consumers documenting npm-published component libraries naturally want `component: '@my-org/button'` to work. Same for `decoratorModules: ['@my-org/theme-provider']` and `css: ['@my-org/theme/light.css']`.

**Decision:** New shared helper `resolveSpec(spec, fromDir)` in `packages/core/src/resolve.ts`:

- Specs starting with `./`, `../`, or `/` → `path.resolve(fromDir, spec)` (unchanged behaviour)
- Otherwise → treat as a bare specifier, resolve via `createRequire(path.join(fromDir, 'package.json')).resolve(spec)` so Node's full module resolution algorithm runs (incl. `package.json#exports`, `#`-prefixed subpath imports, scoped packages, subpath imports like `lodash/get`)
- Bare specifiers that fail to resolve return `null`; callers either fall through to "no props table" silently (`frontmatter.component`) or throw a Markbook-prefixed error pointing at the spec (`:::stories`, decorators, css)

Applied at every parse/build boundary call site so downstream consumers (code extractor, props extractor, entry generator) continue working with absolute paths exclusively. The entry generators in `build.ts` and `embed.ts` get an extra branch: when the spec is bare, the generated `import` statement keeps the bare specifier as-is (Vite resolves it through node_modules at bundle time) instead of computing a relative path from the temp entry dir to a node_modules file (which works but is ugly).

`extractStoryCode` / `discoverStoryExports` / `extractComponentProps` still take absolute paths — `resolveSpec` runs upstream of them. The `react-docgen-typescript` parser walks the TS source / `.d.ts` declaration files the resolved path points at; both shapes work because the TS compiler reads both.

**Consequences:**

- The original use case — `component: '@my-org/button'` in frontmatter — now produces a props table. Validated end-to-end by adding a `package.json#imports` field to `examples/react-demo` and converting the Switch page's `component:` from `'../../src/pixie/Switch.tsx'` to `'#pixie/Switch.tsx'`. The `checked` prop and its JSDoc description still appear in the rendered table.
- Bare-specifier resolution depends on the file being installed in `node_modules` (or addressable via `package.json#imports`/`exports`). When it isn't, Markbook surfaces a clear "could not be resolved" error pointing at the spec — much better than the previous silent failure.
- Relative-path consumers see zero behaviour change. The five existing demo pages with `component: '../../src/pixie/Button.tsx'` etc. continue rendering identically.
- The `:::story` / `:::stories` `src=` change opens up two new patterns: stories live in published npm packages (`src=@my-org/btn/stories/Primary`), and stories live in a workspace package addressed via `#subpath` imports. Both render and bundle correctly; the embed bundle's entry imports the bare specifier directly, leaving Vite to do final module resolution at bundle time.
- `inlineSourceImports` (playground) still operates against `MarkbookConfig.root`-relative globs; it does NOT follow bare-specifier imports into `node_modules`. That's intentional — published packages bring their own resolution to the sandbox via `dependencies` in `playground.dependencies`.

---

## ADR-0022 — User-facing agent skills ship with the npm package, installed via `markbook skills install`

**Context:** Markbook is itself written with agent skills (the `.copilot/skills/` we ship for contributors), but consumers — users running `npm install markbook` — get none of that procedural memory. Documenting a real component library benefits from skills like "scaffold a new project", "generate a docs page for one component", "bulk-generate pages for every component in a directory", "apply a visual preset", "bundle a story for embedding." Hand-rolling these in every consumer's repo wastes everyone's time.

Two related questions: (1) where do the skills live — inside the npm package, on a marketplace, somewhere else? (2) how do they reach the consumer's vendor-CLI surfaces (`.claude/skills/`, `.codex/skills/`, etc.)?

**Decision:**

1. **Skills ship inside the published `markbook` npm package** at `packages/cli/skills/<name>/SKILL.md`. The package's `files` field includes `skills` so npm publishes them. One source of truth, version-pinned with the package.

2. **A new CLI subcommand, `markbook skills install`, distributes them.** Reads `node_modules/markbook/skills/` and copies (or symlinks with `--symlink`) each skill into the consumer's vendor surfaces under a flat namespace: `<surface>/skills/markbook-<name>/`.

3. **Copy by default; symlink opt-in.** Symlinks dangle on pnpm's `node_modules/.pnpm/<hash>` paths and break on Windows. Copying is more robust. Each install drops a `.markbook-skill.json` metadata file recording the source hash + markbook version, so `--update` is deterministic (refresh when the source hash differs from the stored one).

4. **Flat namespace, not nested.** Skills land at `<surface>/skills/markbook-init/SKILL.md`, not `<surface>/skills/markbook/init/SKILL.md`. Cross-vendor support for nested namespaces is uneven; the flat form works everywhere.

5. **Detect existing vendor surfaces; don't create all four.** If the consumer has `.claude/` and `.codex/` in their repo, install to both. If they have none, install to `.claude/` (the most common today) and rely on the user to opt into other surfaces via `--surface`.

6. **Refuse to clobber unmanaged content.** A pre-existing `<surface>/skills/markbook-init/` without our `.markbook-skill.json` is reported as `skipped-unmanaged` unless `--force` is supplied. Protects user-customized or hand-rolled skills that happen to share a name.

7. **Five skills shipped in v1:** `init`, `add-component-page`, `bulk-generate`, `style`, `bundle-story`. `bulk-generate` is dry-run by default — never writes without explicit `--write` after the user reviews the candidate list.

8. **The contributor skill `style-markbook` is now a thin shim** pointing at the canonical user-facing `style` skill under `packages/cli/skills/style/`. The preset CSS files live in one place; no dual-maintenance drift risk.

**Consequences:**

- Consumers run `markbook skills install` once after `npm install markbook`. The 5 skills land in their vendor surfaces; agents (Claude Code, Codex, OpenCode, Cursor) auto-discover them by directory convention. Invocation is via the vendor's own namespacing UI (`/markbook-init`, etc.).
- Updating `markbook` to a newer version doesn't auto-update installed skills — the consumer re-runs `markbook skills install --update` when they want fresh content. `markbook skills list` shows which installed skills drifted from the shipped version (`!out-of-date` flag).
- The shipped skills are markdown text; bundle size impact on the `markbook` package is tiny (~10 KB across the 5 SKILL.md files + 5 CSS preset files for `style`).
- This pattern doesn't require any vendor CLI to support a special "load from npm" convention — it works with any CLI that auto-discovers `<vendor>/skills/<name>/SKILL.md`. As more agent CLIs emerge, supporting them is "add the surface dir name to `VENDOR_SURFACES` in `skills.ts`."
- Pure addition to the public API. `markbook build` / `dev` / `bundle` are unaffected. Existing consumers ignore `skills install` if they don't want it.
- Risk: agents may eventually grow vendor-specific package skill conventions (e.g. Claude reading skills from `node_modules` directly). When that happens, `markbook skills install` becomes a redundant shim; we can deprecate it without breaking anyone (their installed copies keep working until they manually clean them up).

---

## ADR-0023 — Markdown-only sites (optional adapter) + per-page "View / Copy as Markdown" buttons

**Context:** Two distinct asks from a consumer trying Markbook on a non-component-library use case. First: "can I use Markbook to publish a static website that's just markdown-driven, no stories or component framework?" Second: "I'd like a button on each page showing the llms.txt version of that page."

Both have to land cleanly without breaking existing setups (every demo + every consumer with React/Vue/WC adapters).

**Decision:**

1. **`MarkbookConfig.adapter` becomes optional.** When omitted, Markbook supplies an internal `staticAdapter()` (also exported publicly so users can declare it explicitly). The static adapter has no `vitePlugins`, no `decoratorModules`, no `hasControls`, and an `isStatic: true` marker that flips a guard at build time.

2. **The guard catches story directives + static adapter early.** `writePages` checks `ctx.adapter.isStatic && page.parsed.stories.length > 0` for every page and throws a single, structured error pointing at the first three offending pages and suggesting the right adapter (`reactAdapter` / `vueAdapter` / `wcAdapter`). The alternative — letting Vite explode on the generated entry's missing import — produces obscure errors mid-build with no clear recovery path.

3. **Zero-story pages emit no entry script at all.** `generateEntry` used to return `'export {};\n'` for empty pages; the HTML template still loaded that empty module. Now `writePages` skips writing the entry file entirely when `stories.length === 0`, and `generateHtml` accepts `entryBasename: string | null` so it omits the `<script type="module">` tag. Pure markdown pages render with zero JS module loads (just the inline boot scripts for theme/permalinks/copy/etc.).

4. **Per-page llms.txt mirrors get emitted in both `build` AND `dev`.** Extracted `emitPerPageLlmsTxt(pages, baseDir)` from the existing `emitLlms`. Called once from `writePages` against `ctx.tmpDir` (so the dev server and the pre-Vite-build snapshot both have them) and once from `emitLlms` against `ctx.outDir` (the dist copy). This is what makes the "View as Markdown" link resolve in dev — without it the button would 404 against tmpDir which Vite serves.

5. **Two action buttons per page, just below the H1:** "View as Markdown" (plain `<a target="_blank">` to the `.txt`) and "Copy as Markdown" (a `<button>` whose delegated click handler `fetch()`-es the `.txt` and writes to `navigator.clipboard`). The buttons sit in a `<div class="markbook-page-actions" data-pagefind-ignore>` so they don't pollute Pagefind's search index. The boot script also detects `location.protocol === 'file:'` and disables the copy button with a tooltip ("Serve this site over http(s) to copy markdown") — fetch can't reach the .txt over `file://`, and a silently-failing button is worse than a clearly-disabled one.

6. **`MarkbookConfig.llmsButtons?: boolean`** — default `true`. Set `false` to suppress both buttons site-wide. No per-page control (overengineered for v1).

**Consequences:**

- **Zero-config markdown sites become a real Markbook use case.** A user with a `docs/` dir of plain `.md` files and a 4-line `markbook.config.ts` (just `title`) gets a fully-featured static site: chrome, search, dark mode, `--mb-*` theme tokens, page actions, llms.txt mirror. No React/Vue/WC dependency needed.
- **Existing consumers see ONE visible UI change** (the two new buttons appear under every H1). Opt out via `llmsButtons: false`. The button row is small (~28px tall, hover-revealed accent) and styled with the same token system as everything else.
- **The static-adapter-plus-stories error is a one-time correctness gate**, not an ongoing maintenance cost. The check costs O(pages) at build time and produces a copy-pasteable fix.
- **Skipping the entry script for zero-story pages is a real perf win for pure markdown sites.** Each page used to load an empty ESM module just to satisfy the template; now it loads nothing JS-bundled (the inline boot scripts remain, ~1.5 KB total).
- **`emitPerPageLlmsTxt` running in dev** means a per-page regenerate writes 2× the file count (HTML + txt). Both are tiny; total write cost on the React demo's 6 pages is sub-1ms.
- **No new example workspace** — the markdown-only path is validated by a quick manual smoke (build a tmpdir site, verify dist + button + llms.txt land) and the existing demo continues to exercise the full adapter path. A dedicated `examples/markdown-only-demo/` was considered but rejected as workspace bloat (the rubber-duck flagged it explicitly: "an example is bloat unless it's wired into CI; an integration test is the correctness gate").

## ADR-0024 — HTML layout files replace `transformHtml` as the chrome-customization story

**Status:** Accepted (2026-06-03).

**Context.** Markbook shipped with three customization layers (`css`,
`disableBaseCss`, `transformHtml`). The first two are clean — they swap or
augment CSS. The third (`transformHtml`) is an async post-processor that
takes the fully-generated HTML string and returns a new string. It was
designed as an escape hatch but ended up being the only way to do "I want
my own page chrome" — and `examples/marketing-demo/` proved the result is
ugly: ~70 lines of regex-over-HTML in `markbook.config.ts` to strip
Markbook's `<header>`/`<aside>`/`.markbook-shell` and inject a top-nav +
footer + hero.

Three problems with that pattern:
1. Brittle: regex over HTML fails when the engine emits unexpected
   whitespace, attribute order, or class permutations.
2. Hard to maintain: the chrome and the JS that mutates it live in two
   different mental spaces.
3. Wrong tool: chrome customization is an HTML concern. It belongs in HTML
   files, not JS strings.

**Decision.** Introduce a fourth customization layer — file-based HTML
layouts, modeled on Jekyll / Eleventy. New config:

```ts
defineConfig({
  layoutsDir: 'layouts',     // string | string[]; default 'layouts'
  layout: 'default',         // default layout name applied to every page
});
```

Per-page opt-in via frontmatter (`layout: landing`), or opt-out with
`layout: false` (forces the built-in shell even when a default is set).

Layouts are `.html` files with eleven well-defined `{{ }}` placeholders
that Markbook substitutes:

- **Raw HTML tokens** (substituted verbatim, trusted Markbook-generated
  markup): `{{ content }}`, `{{ head }}`, `{{ bodyEnd }}`,
  `{{ pageActions }}`, `{{ search }}`, `{{ themeToggle }}`.
- **Text tokens** (HTML-escaped — safe to interpolate into attributes):
  `{{ title }}`, `{{ description }}`, `{{ siteTitle }}`,
  `{{ browserTitle }}`.
- **Frontmatter access** (HTML-escaped): `{{ frontmatter.<key.path> }}`.

Strict validation throws on any of: missing `{{ content }}`, more than
one `{{ content }}`, unknown placeholder names (typo guard), or a named
layout file that doesn't exist (no silent fallback). HTML comments are
preserved verbatim — placeholders inside `<!-- ... -->` are NOT
substituted, so layout files can document their own placeholder
vocabulary in comments.

`transformHtml` survives unchanged as the escape hatch for narrow
post-processing (analytics injection, attribute rewrites, etc.). It now
runs AFTER layout substitution — so it can patch either the built-in
shell or a layout's output uniformly.

Simultaneously, introduce `contentDir` as the preferred name for what
was `docsDir` (kept as a legacy alias). If both are set, Markbook throws
— silent precedence is more confusing than an explicit error.

**Alternatives considered.**

- **Just keep `transformHtml`.** Rejected. Solves the wrong problem at
  the wrong layer. Doesn't get easier with more pages.
- **Markdown-level templates (existing `templatesDir`) extended to HTML
  shell.** Rejected. Templates wrap markdown with markdown before
  parsing; layouts replace the HTML shell after rendering. Different
  lifecycle stages; conflating them surprises users.
- **Conditionals / loops in the layout (e.g., Liquid or Handlebars).**
  Rejected. KISS — string substitution is enough for a static-site
  shell. If users need branching, they can ship two layouts and pick
  via frontmatter.
- **Per-page nav / TOC / brand text as placeholders.** Held back.
  Including `{{ nav }}` / `{{ toc }}` / `{{ brandText }}` etc. would
  bind layout authors to Markbook's docs conventions (sidebar nav,
  on-this-page TOC, single brand). Marketing layouts hard-code their
  own nav structure anyway. Reconsider per concrete demand.
- **Silent fallback to built-in shell on missing layout file.** Rejected
  (rubber-duck flag). `layout: landng` (typo) would silently render the
  default chrome; impossible to debug. Throwing is the better default.
- **Strip HTML comments before substitution.** Rejected. Many users
  rely on HTML comments for conditional comments, debugging hints,
  structured-data hints. The protect-and-restore sentinel approach
  preserves them while neutralizing in-comment placeholder mentions.

**Consequences.**

- **Four customization layers, well-ordered.** `css` < `disableBaseCss` <
  `layoutsDir` < `transformHtml`, each escalating control. Documented
  this way in `packages/core/README.md`. The marketing demo uses 2 + 3;
  the static demo uses 1; the docs demos use the defaults.
- **The marketing demo shrinks dramatically.** `markbook.config.ts`
  drops from ~100 lines (mostly regex) to ~35 lines (pure config). The
  layout HTML is twice as long but lives where it belongs.
- **Search + llms.txt become composable for non-docs sites.** Both were
  always on; the missing piece was UI hooks. `{{ search }}` exposes the
  Pagefind input slot; the layout's footer can link to `/llms.txt` for
  the per-site mirror. The marketing demo demonstrates both.
- **Public DOM contract slightly expands.** Layout authors now write
  `<article data-pagefind-body>` themselves; that attribute moves from
  "Markbook always emits it" to "Markbook always emits it OR you put it
  in your layout." Documented.
- **Eleven placeholders is the public API.** Each one becomes a
  compatibility promise. The rubber-duck recommended starting smaller
  and we did — the v1 set is the union of "needed by the marketing
  demo" + "needed for search / llms" + "needed for theming". Future
  additions are opt-in and reverse-compatible (unknown placeholders
  already throw at the layout level).
- **`contentDir` aliasing.** Old configs (`docsDir: 'docs'`) keep
  working forever. New examples should use `contentDir`. We may add a
  soft-deprecation warning on `docsDir` in a future minor.
- **Dev watcher includes `layoutDirs`.** Editing a layout file
  triggers a full reload, same as editing markdown or CSS.

## ADR-0025 — User-defined markdown directives via `config.directives`

**Status:** Accepted (2026-06-04).

**Context.** Markbook ships three built-in directives (`:::story`, `:::stories`, `:::props`). The user observed: "the `:::story` markdown tag is pretty great and I'm thinking if we could create an extension model with which people could add more custom tags." Real-world demand surfaces immediately — callouts/admonitions, video embeds, Mermaid diagrams, API endpoint cards, GitHub file embeds, CSV→table renderers. Without an extension model, every site that wants any of these has to fork the parser or fall back to raw HTML in markdown.

**Decision.** Add `MarkbookConfig.directives` — a `Record<string, DirectiveHandler>` registry the user populates from `markbook.config.ts`. Handlers receive the directive's attributes + page context and return HTML to substitute.

```ts
defineConfig({
  directives: {
    youtube: ({ attributes }) =>
      `<iframe src="https://youtube.com/embed/${attributes.id}" allowfullscreen></iframe>`,
    callout: ({ attributes, innerHtml }) =>
      `<aside class="callout callout-${attributes.type ?? 'info'}">${innerHtml ?? ''}</aside>`,
  },
});
```

### Public API

- **`DirectiveHandler = DirectiveHandlerFn | DirectiveHandlerDescriptor`** — the function shorthand accepts both leaf and container forms; the descriptor form `{ type: 'leaf' | 'container', handler }` pins one form and throws on the other (clearer error than silently letting the handler see an unexpected `innerHtml`).
- **`DirectiveContext`** carries `{ name, attributes, type, innerHtml, innerMarkdown, pageFile, root, frontmatter }`. Attributes are typed `Record<string, string | undefined>` (remark-directive emits valueless attrs as `''`; we don't lie about that).
- **`DirectiveResult = string | DirectiveResultObject | null | undefined`** — string shorthand for the simple case; object form carries `{ html, markdown?, dependencies? }`; null/undefined drops the directive.
- **`BUILTIN_DIRECTIVES`** exported constant for users who want to introspect the reserved-name list.
- **`escapeHtml`, `escapeAttribute`** — tiny helpers re-exported so handlers don't import their own.

### Alternatives considered

- **Plain function-as-config (`directives: () => …`).** Rejected — couldn't carry per-directive metadata (the `type` pin), and conflicts with the natural mental model of "a map of name → handler."
- **Lazy `renderInnerHtml()` method on context.** Rejected — adds API surface for marginal benefit (rendering happens at the same cost either way; users would call it 100% of the time in practice).
- **Plugin system / remark plugin pass-through.** Rejected — remark plugins are powerful but exposing them as Markbook's extension surface couples consumers to remark internals. The directive API is narrow on purpose; reach for `transformHtml` for power-user cases.
- **Built-in conflict policy: silently override built-ins.** Rejected (rubber-duck flag). Built-ins have side effects (`:::story` populates `parsed.stories`, story-file resolution kicks in) a user handler can't replicate. Throwing at config load is the safer default.
- **Sync handlers only.** Rejected. The most useful directives (Mermaid, CSV table, GitHub file embed) need file I/O or network access. Async-by-default; sync handlers just return strings.
- **No dependency tracking.** Rejected (rubber-duck flag). Handlers that read files would silently break in dev mode without re-render hooks. Surfacing `dependencies` in the result object is cheap (~10 lines in the watcher) and the right default.

### Consequences

- **Built-in handler dispatch loop in `parse.ts` extended cleanly.** The visitor was already collecting `slots` and resolving them in an async pass; user directives slot into the same pattern as a new `UserDirectiveSlot` kind. Built-in directives still take precedence (story/stories/props names can't be overridden), but every other name is up for grabs.
- **Container directive `innerHtml` semantics: children are pre-rendered through Markbook's standard pipeline.** This means callout-like wrappers "just work" with markdown inside. The trade-off: nested user directives inside a container don't currently re-dispatch — the v1 scope is "render rich markdown inside callouts," not "deeply compose directive trees." Documented in the dispatcher source.
- **`innerMarkdown` alongside `innerHtml`.** Cheap, future-proofs handlers that need the raw source (Mermaid passes the text to mermaid.js verbatim; a syntax-highlight directive might want the unparsed code).
- **Dev-mode dep tracking.** Handler-reported `dependencies` flow through `ParsedPage.directiveDependencies` → `WritePagesResult.directiveDependencies` → the chokidar watch list in `dev()`. New deps discovered on regeneration get `watcher.add`ed in the same loop that handles new story files.
- **Errors get file:line context + `{ cause }`.** When a handler throws, we wrap with `Markbook: directive 'X' in /path/to/page.md:L:C threw: <message>` and preserve the original via `Error.cause`. Standard Node error patterns; debuggable.
- **Pinned-type validation.** Descriptor-form handlers can declare `type: 'leaf' | 'container'`. When the user writes the directive with the wrong form, Markbook throws with the source position — much better than silently passing `innerHtml: null` to a handler that expected content. Function-shorthand handlers accept both forms; the handler can branch on `ctx.type` if it cares.
- **Reserved name validation.** Built-in conflict throws at `createContext`; invalid characters throw too (remark-directive's parser only matches `/[a-z][a-z0-9-]*/i`, so anything else would silently never fire — better to throw than to ship a no-op).
- **`escapeHtml` / `escapeAttribute` re-exported.** Same implementation today, separately named so handler authors reach for the right tool — and so a future minor can diverge (e.g. percent-encoding for URLs) without breaking callers.
- **Public API gains 8 new exports**: `BUILTIN_DIRECTIVES`, `DirectiveHandler`, `DirectiveHandlerFn`, `DirectiveHandlerDescriptor`, `DirectiveContext`, `DirectiveResult`, `DirectiveResultObject`, `escapeHtml`, `escapeAttribute`. Every one has a TSDoc explaining intent. The surface is small but each piece is locked in for v1.0.

## ADR-0026 — Shared adapter runtime in `@doidor/markbook-adapter-shared`

**Status:** Accepted (2026-06-05).

**Context.** The three framework adapters (`adapter-react`, `adapter-vue`, `adapter-wc`) each shipped their own byte-for-byte copies of the browser-side mount plumbing — `injectCss`, `applyParameters`, `resolveMountTarget`, the `LAYOUT_CLASSES` constant, and the `StoryParameters` / `MountOptions` shapes. The web-components copy had already drifted (its comments referenced "see adapter-react's injectCss"), which is exactly how three copies silently diverge. The CSS-injection helper in particular is non-trivial (shadow-root vs `document.head`, dedup by `cssId`) and a subtle fix to one copy would not propagate.

**Decision.** Extract the framework-agnostic browser runtime into a new first-class package, `@doidor/markbook-adapter-shared`, that every adapter depends on at runtime.

- **Pure DOM, zero deps.** It imports nothing from Node and nothing from any framework, so it bundles into each adapter's *default browser entry* without violating the two-entry split (ADR-0005). It builds with the same `tsc -b` + `tsconfig.base.json` (which already includes the `DOM` lib) as the other packages.
- **Share the helpers + the common option subset, not a single `MountOptions`.** Exports `applyParameters`, `resolveMountTarget`, `injectCss`, `StoryParameters`, and `BaseMountOptions` (`{ isolation?, parameters?, css?, cssId? }`). Each adapter `extends BaseMountOptions` with what it actually supports — React/Vue add `args` + their own decorator type; web components use the base as-is. A single shared `MountOptions` was rejected: it would let the WC adapter appear to accept `args`/decorators it doesn't implement, or erase React/Vue decorator specificity.
- **Runtime dependency, `workspace:*`.** Each adapter lists `@doidor/markbook-adapter-shared` under `dependencies` (not `devDependencies`) so the published npm packages declare it correctly; `workspace:*` is rewritten to the real version on publish. It must be published/versioned in lockstep with the adapters.

**Alternatives considered.**
- **A shared source file outside `packages/`.** Rejected — it wouldn't publish cleanly; the adapters ship only their own `dist/`, so anything they import at runtime has to be a real package.
- **Put the helpers in `@doidor/markbook-core`.** Rejected — `core` pulls in Vite, the TS compiler, Pagefind, and `node:` built-ins; importing it into a browser bundle would drag all of that across the two-entry split. The shared runtime must stay browser-only.
- **Leave the duplication.** Rejected — three copies of a 100-line DOM module that already drifted is a maintenance trap; a one-line CSS-injection fix should land in one place.

**Consequences.**
- New package surface to maintain, version, and publish in lockstep with the adapters (the cost the ADR accepts in exchange for de-duplication).
- The adapters' public API is unchanged: each still exports `mount` (and React `setupControls` / `ArgType`) and re-exports `StoryParameters` (now from the shared package, same shape).
- `tsc -b` topological ordering builds `adapter-shared` before the adapters; the verify cycle's typecheck step relies on the shared `dist/` existing (the same pre-existing constraint that already applies to `@doidor/markbook-core`).

## ADR-0027 — `tsc --noEmit` typecheck resolves workspace deps from source

**Status:** Accepted (2026-06-05).

**Context.** The downstream packages (`cli`, `adapter-react`, `adapter-vue`, `adapter-wc`) import `@doidor/markbook-core` (and now `@doidor/markbook-adapter-shared`). With `moduleResolution: "Bundler"`, TypeScript resolves those bare specifiers through `node_modules` to each package's `types` → `./dist/index.d.ts`. On a clean checkout that file doesn't exist until `pnpm build`, so `pnpm typecheck` (which CI runs *before* `pnpm build`) failed with `TS2307: Cannot find module '@doidor/markbook-core'`. It only appeared to pass locally because a prior build had left `dist/` lying around. Adding `paths` to the shared `tsconfig.base.json` fixed resolution but broke the emit build: the build configs set `rootDir: ./src`, so pulling sibling source in via `paths` tripped `TS6059` ("not under rootDir").

**Decision.** Split typecheck from build. Each downstream package's `typecheck` script runs `tsc -p tsconfig.typecheck.json`, a config that extends `tsconfig.typecheck.base.json` (root). That base sets `noEmit: true`, no `rootDir`/`outDir`, and `paths` mapping the three workspace specifiers to their `src/index.ts`. The per-package *build* configs (`tsconfig.json`, used by `tsc -b`) are untouched and still resolve deps from `dist/` in pnpm's topological order. `core` and `adapter-shared` keep plain `tsc --noEmit` — they have no workspace dependencies, so they already typecheck standalone.

**Alternatives considered.**
- **`paths` in `tsconfig.base.json`.** Rejected — shared by the emit build, which then hits `TS6059` because the path-mapped source sits outside each package's `rootDir`.
- **Build before typecheck** (`typecheck: pnpm build && tsc --noEmit`, or reorder CI). Rejected — slower, and leaves typecheck unable to stand on its own; the point is a fast, build-independent type gate.
- **TypeScript project references.** Rejected for now — heavier migration (every package needs `composite: true` + `references`), and `tsc -b` still emits `.d.ts` to consume, so it doesn't make `--noEmit` typecheck build-free the way source `paths` do.

**Consequences.**
- `pnpm typecheck` (and `pnpm --filter <pkg> typecheck`) now pass from a clean checkout with no `dist/` present — CI's lint → typecheck → build order is self-consistent.
- Type errors in a dependency's public API surface at the consumer immediately (typecheck reads source, not a stale `dist/`), which is strictly better feedback.
- New files to keep in sync: `tsconfig.typecheck.base.json` + one `tsconfig.typecheck.json` per downstream package. When a new workspace package is consumed by another, add it to the `paths` map.

---

## ADR-0028 — Remove the Vue and Web Components adapters; React-only until they're rebuilt

**Status:** Accepted (2026-06-06).

**Context.** The repo shipped three framework adapters (`@doidor/markbook-adapter-react`, `-vue`, `-wc`) plus two proof demos (`examples/vue-demo`, `examples/wc-demo`). In practice only the React adapter was carried to feature parity — `:::props` tables are React-only (`react-docgen-typescript`), interactive controls were React-only, and decorators were React/Vue-only. The Vue and WC packages were thin and under-exercised, and every doc that listed "three adapters" overstated what actually works. Maintaining (and documenting) three adapters while only one is first-class was a recurring source of drift.

**Decision.** Delete `packages/adapter-vue`, `packages/adapter-wc`, `examples/vue-demo`, and `examples/wc-demo`. Keep `@doidor/markbook-adapter-react` and `@doidor/markbook-adapter-shared` (React still consumes the shared browser runtime). Document everywhere — root `README.md`, the docsite (`examples/markbook-site`), `ROADMAP.md`, and the agent harness (`AGENTS.md`, `.copilot/`) — that **React is the only implemented adapter** and that Vue + Web Components adapters are planned, not shipped. The CI matrix, root `package.json` scripts, and `scripts/examples-dev.mjs` drop the Vue/WC builds.

**Alternatives considered.**
- **Keep the packages as "experimental".** Rejected — they still appeared in install docs and the adapter table as if production-ready, which is the exact dishonesty this change removes.
- **Keep the demos, delete only the packages.** Rejected — the demos can't build without their adapters, so they'd be dead weight and a broken CI step.
- **Fold `@doidor/markbook-adapter-shared` back into `@doidor/markbook-adapter-react`.** Deferred — `adapter-shared` is the seam the future Vue/WC adapters will reuse (ADR-0026), so keeping it avoids re-extracting it later. It's now a single-consumer package, which is acceptable.

**Consequences.**
- The framework-adapter surface is honest: one package, one demo path, one set of docs.
- Vue + Web Components adapters move to `ROADMAP.md` as a single deferred item to be rebuilt against the unchanged `MarkbookAdapter` contract (each consuming `@doidor/markbook-adapter-shared`).
- The `MarkbookAdapter` contract, `staticAdapter()`, and the core engine are unchanged — re-adding an adapter later is purely additive and needs no core changes.
- The published `markbook` CLI skills (`init`, `bulk-generate`, …) now scaffold/detect React only; a future adapter re-adds its branch.

---

## ADR-0029 — Publish under the `@doidor` npm scope (`@doidor/markbook*`)

**Status:** Accepted (2026-06-08).

**Context.** The packages were unpublished workspace packages: `markbook` (CLI), `@markbook/core`, `@markbook/adapter-react`, `@markbook/adapter-shared`, all at `0.0.0` with `workspace:*` cross-refs. To publish, every package in the dependency chain must be published — a scoped package can't depend on unpublished ones. Two blockers: the bare name `markbook` is already taken on npm (an unrelated package at `0.0.3`), and the `@markbook` scope isn't owned. The maintainer owns the `@doidor` user scope (matches the GitHub org).

**Decision.** Re-scope all four packages under `@doidor/`:
- `markbook` → `@doidor/markbook` (CLI; `bin: { markbook }` is unchanged, so the `markbook` command and all `markbook <cmd>` invocations stay identical)
- `@markbook/core` → `@doidor/markbook-core`
- `@markbook/adapter-react` → `@doidor/markbook-adapter-react`
- `@markbook/adapter-shared` → `@doidor/markbook-adapter-shared`

Each package gains `publishConfig.access: "public"`, `license: "MIT"` + a bundled `LICENSE`, `repository.directory`, `homepage`, `bugs`, and `keywords`. Versions bump `0.0.0 → 0.1.0` in lockstep. The private example/site workspace packages keep their `@markbook/*` names — they're never published, so renaming them would be churn with no payoff. Historical `@markbook/*` mentions in `DECISIONS.md`/`PROGRESS.md` are left intact (append-only record of the names as they were).

**Alternatives considered.**
- **Publish the CLI as `@doidor/markbook` but keep deps under `@markbook`.** Rejected — requires owning/creating the `@markbook` org, and splits the package identity across two scopes.
- **Publish `markbook` unscoped.** Impossible — the name is taken.
- **A single bundled package.** Rejected — the adapter contract (ADR-0003/0005) and the core/adapter split are intentional; consumers pick the adapter they need.

**Consequences.**
- `pnpm publish` rewrites `workspace:*` → `0.1.0`, so the published tarballs depend on the concrete versions. Publish order must respect the graph: `adapter-shared` → `core` → `adapter-react` → CLI.
- All install docs, the `init`/bundle CLI skills, `reactAdapter().packageName` (baked into generated boot scripts), and the `tsconfig.typecheck` path maps now reference `@doidor/markbook-*`.
- Future Vue/WC adapters (ROADMAP) will be `@doidor/markbook-adapter-vue` / `-wc`.

## ADR-0030 — Agent-first positioning + Starlight-style mobile nav

**Status:** Accepted (2026-06-09).

**Context.** Two pre-v1.0 quality gaps surfaced in user feedback:
1. The six skills shipped via `markbook skills install` (`markbook-init`, `markbook-add-component-page`, `markbook-bulk-generate`, `markbook-style`, `markbook-layout`, `markbook-bundle-story`) were only documented in `packages/cli/README.md`'s `markbook skills install` subsection — not surfaced anywhere on the docs site or the top-level README. This buried Markbook's biggest differentiator vs Storybook / Starlight / Docusaurus, none of which ship installable agent skills as part of their npm package.
2. The default chrome's mobile responsive breakpoint hid the entire sidebar (`@media (max-width: 700px) { .markbook-sidebar { display: none; } }`) with no toggle, leaving mobile users with no way to navigate. This directly contradicted the README's claim of a "Starlight-style HTML site" — Starlight's first mobile UX rule is a working hamburger menu.

**Decision.**

*Agent-first positioning.* Promote the shipped skills to a first-class concept across the docs:
- New guide page `pages/guides/agent-skills.md` — opens with the agent-first design rationale (skills as a first-class output of the build, not a docs page somewhere) + per-skill blurb cards. `order: 2` so it sits right under Getting started.
- New reference page `pages/reference/skills.md` — every flag of every skill, the deep-dive for writing an AGENTS.md / pinning a procedure.
- Home page (`pages/index.md`) gets an "Agent-first by default" hero spotlight section, an "🤖 Agent-first by default" feature card (now the first card), and guide-grid cards for both the new guide and reference.
- Landing top-nav (`layouts/landing.html`) gains a "Skills" link.
- This codifies the framing established by ADR-0022 (skills distribution mechanism): skills are a product surface, not docs scaffolding.

*Mobile nav contract.* Add a hamburger toggle to the built-in chrome with these DOM hooks (part of the v1.0-stable surface alongside `[data-markbook-copy]`, `[data-markbook-permalink]`, etc.):
- `<button data-markbook-nav-toggle aria-controls="markbook-sidebar" aria-expanded="false">` — emitted as the first child of `.markbook-header`. Visible only via CSS at `@media (max-width: 700px)`.
- `<div data-markbook-nav-backdrop>` — emitted as a sibling of `.markbook-shell`. Fixed-position, dim overlay, dismiss-on-click.
- `body[data-markbook-nav-open]` — the open-state scope. Sidebar slides from `transform: translateX(-100%)` to `translateX(0)`, backdrop becomes visible, body scroll locks.
- `#markbook-sidebar` on `<aside class="markbook-sidebar">` — so `aria-controls` resolves.

The CSS slide-in is `@media`-scoped under `max-width: 700px` — on desktop, the body attribute and backdrop do nothing visible. A `prefers-reduced-motion: reduce` block disables the transition. The boot script (`NAV_TOGGLE_BOOT_SCRIPT` in `assets.ts`, alongside the seven existing IIFEs) handles delegated click on the toggle, Escape-to-close (restores focus to the toggle), click-on-sidebar-link to auto-close (so the user lands on the destination page without a stale open menu), and click-on-backdrop to dismiss. The toggle is always emitted in the built-in shell; layout authors using `layoutsDir` opt in by adding the same data attributes to their own markup (the boot script is delivered via `{{ head }}` for free).

**Alternatives considered.**

*For the skills surfacing:*
- **Single combined "Agent skills" section on the home page only.** Rejected — a dedicated guide + reference is the same shape as every other Markbook concept (config, CLI, directives, frontmatter), and the per-flag depth needs a reference page.
- **Move the skills out of the npm package into a separate `@doidor/markbook-skills` plugin.** Rejected — keeps the skills out of every project that already installed `markbook` and re-introduces the discoverability problem we're trying to solve. ADR-0022 settled this in the other direction.

*For the mobile nav:*
- **Keep `.markbook-sidebar { display: none }` and add a CSS-only `:target`-based toggle.** Rejected — no way to restore focus on Escape, no body-scroll lock, no `aria-expanded` sync, and CSS-only toggles don't survive page navigation cleanly.
- **Use the `inert` attribute on the sidebar when closed.** Considered, then deferred — `inert` is supported in modern browsers but adds JS complexity (toggle inert based on viewport + open state), and the `transform: translateX(-100%)` + `aria-hidden` approach is enough for v1.0. Revisit if focus-trap leakage becomes a real complaint.
- **Top-drawer (slides down from header) instead of left-slide-out.** Rejected — Starlight + GitBook + Mintlify all use left-slide-out, matches user mental model.

**Consequences.**

- The four new DOM hooks join the v1.0-stable contract in `ROADMAP.md` (the list of frozen items). Anyone with a custom layout (`layoutsDir`) gets the nav toggle free if they add `data-markbook-nav-toggle` + `data-markbook-nav-backdrop` to their own markup — no rendering changes required from us.
- `InlineAssets.navToggleBoot` is a new field; downstream consumers of `getInlineAssets()` (internal) get the script automatically via `buildHeadInjections`.
- `build-integration.test.ts` gains a test asserting the toggle button, sidebar id, backdrop, ARIA wiring, mobile media query, and boot script are all emitted. The existing "renders the default Markbook chrome" test updates its sidebar assertion to include the new `id="markbook-sidebar"` attribute.
- The agent-skills guide + reference become part of the canonical site under `dist/guides/agent-skills.html` and `dist/reference/skills.html`. The home page restructure adds two new feature/guide cards.

**Update (2026-06-09, post-shipping):** First version of the mobile nav used a 320px-wide slide-out drawer with a dim backdrop overlay. User feedback flagged it as visually awkward (white sidebar on the left, dim page content on the right, with a visible seam) — compounded by a layout bug where `bottom: 0` on the fixed-position sidebar was silently overridden by an inherited `align-self: start` from the desktop rule, so the panel sized to intrinsic content (~340px) instead of filling the viewport (788px). Both issues fixed in one pass: explicit `align-self: stretch` on the mobile rule, and switched the panel to **full-viewport width** (`inset: var(--mb-header-height) 0 0 0`) — matches Starlight's actual behaviour, removes the half-and-half visual, eliminates the need for the backdrop on mobile. The backdrop element stays emitted (display:none on mobile) so layout authors who want the side-drawer pattern can opt back in from their own CSS. Wiki entry `.copilot/wiki/align-self-on-fixed-children.md` captures the `align-self`-on-fixed-children gotcha so the next contributor doesn't trip on it.
