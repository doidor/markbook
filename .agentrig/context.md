# Repository context — markbook

_Investigation written by AgentRig's installer agent. Evidence-cited; intended to be a stable
reference for future autonomous coding sessions in this repo._

## 1. Purpose

**Markbook** is a lightweight, **markdown-first Storybook alternative**: a static-site engine that
turns a directory of `.md` pages into a Starlight-style HTML site (full-text search, dark mode, an
`llms.txt` mirror, SEO defaults, sitemap) and can mount adjacent component stories via
`:::story` / `:::stories` directives. Authors write plain Markdown; component examples live in
sibling `.tsx`/`.ts` files referenced by directives — no MDX, no JSON sidecars.

It's a **pre-1.0 personal project** by `doidor`, published to npm under the `@doidor/` scope. Today
**only the React adapter ships**; Vue and Web Components adapters are on the roadmap (ADR-0028).
Consumers are component-library authors and docs/marketing teams who want one tool that produces
both component docs (with live stories) and pure docs/marketing sites, plus portable embeddable
story bundles. (Evidence: `README.md` §Why Markbook / §Status; `package.json` description; license
`MIT` on all published packages.)

## 2. Stack

- **Language:** **TypeScript 5.6+** throughout, compiled with `tsc -b` to ESM (`"type": "module"`
  in every package.json; `tsconfig.base.json` targets ES2022, `module: ESNext`,
  `moduleResolution: Bundler`, `strict: true`, `verbatimModuleSyntax: true`,
  `noUncheckedIndexedAccess: true`).
- **Runtime:** **Node ≥ 20** (root `package.json` `engines.node: ">=20"`; CI uses Node 20; the
  Copilot setup-steps workflow uses Node 22).
- **Package manager:** **pnpm 8.15.9**, pinned in root `package.json`
  (`"packageManager": "pnpm@8.15.9"`). Lockfile `pnpm-lock.yaml` v6.0. Workspaces:
  `packages/*` + `examples/*` (`pnpm-workspace.yaml`).
- **Linter / formatter:** **Biome 2.4.14** (single tool for both). Config in `biome.json` — 2-space
  indent, single quotes, semicolons, trailing-commas all, 100-char line width, ignores `dist/`,
  `.markbook/`, `_layouts/`, layout/directive `*.html` templates, `pnpm-lock.yaml`,
  `*.tsbuildinfo`, and several agent-tooling paths.
- **Tests:** **Vitest 2.1+**, co-located with sources (`*.test.ts` next to `*.ts`). Only
  `@doidor/markbook-core` and `@doidor/markbook` (cli) have test suites today (the root `test`
  script filters to just those two).
- **Build backbone for user sites:** **Vite 5.4+** (ADR-0002), driven programmatically from
  `@doidor/markbook-core`. Markdown pipeline: `unified` + `remark-parse` / `-frontmatter` /
  `-gfm` / `-directive` → `remark-rehype` → `rehype-slug` → `rehype-stringify`, plus `shiki` for
  syntax highlighting, `pagefind` for search (ADR-0004/0009), `react-docgen-typescript` for prop
  tables (ADR-0007), `gray-matter`, `chokidar`, `tinyglobby`, `lz-string`.
- **CLI plumbing:** `cac` (command parsing) + `jiti` (TS config loader). Binary name `markbook`
  (`packages/cli/package.json` → `"bin": { "markbook": "./bin/markbook.js" }`).
- **Release / versioning:** **Changesets** (`@changesets/cli` + `@changesets/changelog-github`),
  with the four `@doidor/markbook*` packages versioned in lockstep via the `fixed` group in
  `.changeset/config.json`. Publishing is tokenless via npm **OIDC Trusted Publishing**
  (`.github/workflows/release.yml`, ADR-0029) — never run `npm publish` by hand.
- **Git hooks:** **Husky** (`.husky/pre-commit` → `pnpm lint && pnpm typecheck && pnpm test`,
  fail-fast).

## 3. Commands

All evidence from root `package.json` `scripts` block, `.github/workflows/ci.yml`, `.husky/pre-commit`,
and the per-package `package.json` files. CI runs them in the exact order shown.

### Install

```
pnpm install --frozen-lockfile
```

(CI: `.github/workflows/ci.yml` line 30; reproduces deterministically against `pnpm-lock.yaml`.
For local development first runs, plain `pnpm install` is fine.)

### Lint

```
pnpm lint        # biome check .         (root package.json line 15)
pnpm lint:fix    # biome check . --write (auto-fix most issues; line 16)
pnpm format      # biome format . --write (formatter only; line 17)
```

### Typecheck

```
pnpm typecheck   # pnpm -r typecheck (line 14) → runs each package's typecheck script
```

Per-package typecheck strategies (notable nuance):
- `@doidor/markbook-core` / `@doidor/markbook-adapter-shared`: `tsc --noEmit` (plain).
- `@doidor/markbook` (cli) / `@doidor/markbook-adapter-react`: `tsc -p tsconfig.typecheck.json` —
  uses `tsconfig.typecheck.base.json` which path-maps `@doidor/markbook-core` (and `/internal`) and
  `@doidor/markbook-adapter-shared` to source (`packages/*/src/index.ts`) so cross-package types
  resolve without a prior build (ADR-0027).

### Build

```
pnpm build       # pnpm -r --filter './packages/*' build  (line 12)
                 # → each package runs `tsc -b` to emit dist/
```

Topological build: pnpm resolves the order from `workspace:*` deps. `tsbuildinfo` files give
incremental rebuilds.

### Test

```
pnpm test        # pnpm -r --filter '@doidor/markbook-core' --filter '@doidor/markbook' test
                 # (root package.json line 13)
                 # → each runs `vitest run`
```

Only `core` and `cli` packages have test scripts/suites today.

### Pre-commit (already automated by Husky)

```
pnpm lint && pnpm typecheck && pnpm test
```

(`.husky/pre-commit`)

### Example demos (also run in CI)

```
pnpm example:build              # React demo
pnpm example:bundle             # React demo embed bundles
pnpm example:static:build       # markdown-only static demo
pnpm example:marketing:build    # custom-layout marketing demo
pnpm example:site:build         # the official Markbook docs site
pnpm examples:build             # all examples in parallel (--parallel)
pnpm examples:dev               # all dev servers in parallel via scripts/examples-dev.mjs
```

### Release (CI-driven; do not run locally)

```
pnpm changeset           # author a changeset
pnpm version-packages    # changeset version (run by CI in the Version PR)
pnpm release             # pnpm build && changeset publish (run by CI on merge)
```

### Pre-handoff verification

The repo has a documented verification cycle in `.copilot/skills/verify-build/SKILL.md`:
`pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` → the five `example:*:build` /
`example:bundle` commands above. Iteration cap N=3 on the same root cause. See also
[`AGENTS.md` Critical Rule #4].

### Things that do NOT exist

- **No `pnpm dev` at the root.** Per-example dev servers via `pnpm example:*:dev` or
  `pnpm examples:dev`.
- **No coverage script.** Vitest is invoked as `vitest run` only.
- **No e2e / integration script** separate from the example builds.

## 4. Layout

```
/                          ← monorepo root
├── AGENTS.md              authoritative agent constitution (also surfaced via CLAUDE.md)
├── CLAUDE.md              generated pointer at AGENTS.md (do not edit; see header comment)
├── README.md              user-facing pitch + quick start
├── PROGRESS.md            append-only journal (~232 entries; see /progress-log skill)
├── DECISIONS.md           ADR log (~30+ ADRs, e.g. ADR-0001 directives-not-MDX, ADR-0029 OIDC)
├── ROADMAP.md             forward-looking work; current state ~v0.10+; goal v1.0 API freeze
├── RELEASING.md           Changesets + OIDC publish flow (see also .github/workflows/release.yml)
├── LICENSE                MIT
├── package.json           workspace root; scripts; pnpm@8.15.9 pin; engines node>=20
├── pnpm-workspace.yaml    packages/* + examples/*
├── pnpm-lock.yaml         v6.0 lockfile
├── tsconfig.base.json     shared strict TS config (ES2022, ESM, strict, verbatimModuleSyntax)
├── tsconfig.typecheck.base.json  path-mapped variant for cross-package typecheck (ADR-0027)
├── biome.json             lint + format config (Biome 2.4.14)
├── .changeset/            changeset config + pending changesets (fixed: 4 packages in lockstep)
├── .husky/pre-commit      pnpm lint && pnpm typecheck && pnpm test
├── .github/
│   ├── workflows/ci.yml             lint → typecheck → build → test → 5 example builds
│   ├── workflows/release.yml        Changesets + tokenless OIDC publish (ADR-0029)
│   ├── workflows/deploy-docs.yml    builds + deploys examples/markbook-site to GH Pages
│   ├── workflows/copilot-setup-steps.yml  Copilot coding-agent env bootstrap (Node 22 + pnpm)
│   ├── copilot-instructions.md / copilot/ / instructions/   IDE-side agent instructions
├── scripts/
│   ├── examples-dev.mjs             runs all example dev servers in parallel
│   └── repair-worktrees.sh
├── packages/                         ← published npm packages (all @doidor scope, MIT, v0.1.2)
│   ├── core/                @doidor/markbook-core — engine (parse, build, dev, embed, directives)
│   │   ├── src/             ~25 modules incl. parse.ts / build.ts / embed.ts / config.ts
│   │   │                     / props.ts / nav.ts / template.ts / pagefind.ts / fenced-code.ts
│   │   │                     plus *.test.ts co-located
│   │   ├── src/index.ts     public API barrel — STABLE surface
│   │   ├── src/internal.ts  unstable surface (reachable via @doidor/markbook-core/internal)
│   │   ├── AGENTS.md        package-specific rules (no framework imports, AST > regex, cache invalidators)
│   │   ├── README.md        public API docs
│   │   └── package.json     dual exports `.` + `./internal`; deps: vite, remark-*, shiki, pagefind, …
│   ├── cli/                 @doidor/markbook — `markbook` CLI binary (cac + jiti)
│   │   ├── bin/markbook.js  entry point
│   │   ├── src/index.ts     command definitions: build, dev, preview, bundle, skills install|list
│   │   ├── src/skills.ts    skill distribution to .claude/.codex/.opencode/.agents (+ tests)
│   │   ├── skills/          USER-FACING skills shipped in the npm package: add-component-page,
│   │   │                     bulk-generate, bundle-story, init, layout, style (see ADR-0022)
│   │   ├── tsconfig.typecheck.json  separate typecheck config (path-mapped)
│   │   └── README.md
│   ├── adapter-react/       @doidor/markbook-adapter-react — only implemented framework adapter
│   │   ├── src/index.ts     mount() (default entry — browser side)
│   │   ├── src/config.ts    reactAdapter() (./config subpath — Node side); ADR-0005 split
│   │   ├── src/controls.ts  interactive controls panel
│   │   ├── AGENTS.md        two-entry split is non-negotiable; react+react-dom are peer deps
│   │   └── package.json     react / react-dom as peerDependencies; @vitejs/plugin-react in deps
│   └── adapter-shared/      @doidor/markbook-adapter-shared — shared browser runtime
│       └── src/index.ts     CSS injection, shadow-root mounting, parameters (ADR-0026)
├── examples/                ← workspace-private dogfood sites (each runs `markbook build`/`dev`)
│   ├── react-demo/                  Pixie component library (canonical React-adapter dogfood)
│   ├── static-demo/                 markdown-only Skyline docs site (no adapter)
│   ├── marketing-demo/              Cumulus marketing site (disableBaseCss + layoutsDir + transformHtml)
│   ├── markbook-site/               the official Markbook website; markdown-only with custom :::callout
│   └── embed-host/                  external consumer of the React demo's embed/package bundles
├── .copilot/                ← canonical agent surface (SINGLE source of truth)
│   ├── skills/              add-stories, bundle-story, fix-ci, harness-eval, progress-log,
│   │                         self-verify, skill-authoring, skill-improver, style-markbook,
│   │                         verify-build, verify-loop
│   ├── rules/               code-review, coding-standards, core-no-framework, harness-on-
│   │                         architectural-change, no-debug-logging, progress-on-package-edit,
│   │                         security, tests-co-located
│   └── wiki/                cumulative gotchas (shadow-tokens, playground-inline-source-imports,
│                             css-in-ts-template-literal, vite-tmpdir-watching, html-layout-gotchas,
│                             biome-jsx-expression-in-html-templates, parallel-mkdir-then-create)
├── .claude/                 hooks (post-edit-reminder, stop-progress-check, stop-harness-check)
│                             + settings.json; rules/skills/wiki are SYMLINKS into .copilot/
├── .codex/, .opencode/, .agents/    each has rules/skills/wiki SYMLINKS into .copilot/
├── .cursor/rules/           Cursor-specific MDC rules (real directory, not symlink)
├── .agentrig/               AgentRig harness files (this file lives here)
└── .vscode/mcp.json, .mcp.json   MCP server configuration for various clients
```

## 5. Conventions

### "Instructions are the source of truth" docs

Three files at the root frame agent behaviour. They all open with the literal phrase
> "Instructions in this file are the source of truth, not existing code. When code patterns and
> this file disagree, follow this file and update the code."

- **`AGENTS.md`** — repo-wide agent constitution. Loaded by Codex / OpenCode / Cursor / Copilot
  CLI / Claude Code (the last via `CLAUDE.md`'s `@AGENTS.md` import). Contains the 7 Critical
  Rules (markdown is source of truth; no framework code in core; public API = `index.ts` only;
  verify before handoff with N=3 iteration cap; update `PROGRESS.md` for user-facing/architectural
  changes; one logical change per commit with `Co-authored-by: Copilot` trailer; authoring stays
  simple).
- **`packages/core/AGENTS.md`** — engine-specific rules: no framework imports; `index.ts` vs
  `internal.ts` discipline; tests import sibling source modules (not the barrel); AST > regex via
  the TS compiler API; in-module `Map` caches must export `invalidateXCache()`; the three built-in
  directives (`story`, `stories`, `props`) are immutable; `htmlTemplate` stays substitution-only.
- **`packages/adapter-react/AGENTS.md`** — adapter-specific rules: ADR-0005 two-entry split is
  non-negotiable; `react`/`react-dom` are peer deps (never direct); decorator composition is
  outer-to-inner; controls panel falls back to text input on unknown kinds.

### Commit / change conventions

- **One logical change per commit.** (Critical Rule 6.)
- **Required Co-author trailer** on every commit:
  `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`. (Critical Rule 6.)
- **Pre-commit hook** runs `pnpm lint && pnpm typecheck && pnpm test`; bypasses are not authorized.
- **Releases via Changesets only.** Add a changeset (`pnpm changeset`) with each user-visible
  change — the four `@doidor/markbook*` packages are bumped in lockstep (`fixed` group). Never
  hand-edit `package.json` versions or push tags manually.

### Documentation discipline (enforced by rules + hooks)

- **Any change under `packages/**` that is non-trivial → append to `PROGRESS.md`** in the same
  commit. Use the `/progress-log` skill for the format. Rule:
  `.copilot/rules/progress-on-package-edit.md`. Hooks:
  `.claude/hooks/post-edit-reminder.mjs` (during session) and
  `.claude/hooks/stop-progress-check.mjs` (at session end).
- **Architectural / public-API changes also → update docs in the same commit:** the package
  README, AGENTS.md "Where to look first" table if a future agent would have to grep for the
  answer, sometimes ROADMAP/README's status block, sometimes a new ADR in `DECISIONS.md` for
  non-obvious choices. Rule: `.copilot/rules/harness-on-architectural-change.md`. Hook:
  `.claude/hooks/stop-harness-check.mjs`.

### Code conventions

- **Co-located tests:** `parse.ts` ↔ `parse.test.ts` in the same directory. No `__tests__/` or
  `test/` folders. Rule: `.copilot/rules/tests-co-located.md`.
- **Tests import from sibling source modules** (`from './parse.js'`), NOT from the public barrel
  (`from '@doidor/markbook-core'`). Keeps the API split honest.
- **`index.ts` is the stable public API; `internal.ts` is the volatile surface** that can change
  between minor releases.
- **No framework imports in `@doidor/markbook-core/src/**`.** Enforced by
  `.copilot/rules/core-no-framework.md`; expose new framework hooks via the `MarkbookAdapter`
  contract instead.
- **TS compiler API preferred over regex** for AST work (used in `code.ts`, `exports.ts`, and
  transitively in `props.ts` via `react-docgen-typescript`).
- **Biome style:** 2-space indent, single quotes, semicolons always, trailing commas all,
  100-char line width, arrow parens always. Several recommended rules are explicitly off:
  `noExplicitAny`, `noConsole`, `useImportType`, `useTemplate`, `noNonNullAssertion`,
  `useLiteralKeys`. `organizeImports` is also off.
- **Cleanup in tests:** wrap fs writes in `try/finally`, prefer `os.tmpdir()` mkdtemp.
- **No debug spew in commits** (`console.log` / `debugger;` introduced for investigation must be
  removed before handoff). Rule: `.copilot/rules/no-debug-logging.md`.

### Two-tier skills system

- **Contributor skills** (`.copilot/skills/<name>/SKILL.md`) — for working inside this repo;
  mirrored into `.claude/`, `.codex/`, `.opencode/`, `.agents/` via symlinks. Examples:
  `verify-build`, `progress-log`, `add-stories`, `style-markbook`, `bundle-story`.
- **User-facing skills** (`packages/cli/skills/<name>/SKILL.md`) — shipped inside the published
  `@doidor/markbook` npm package and installed by consumers via `markbook skills install` into
  `<vendor>/skills/markbook-<name>/`. Examples: `init`, `bulk-generate`, `style`,
  `add-component-page`, `bundle-story`, `layout`. Distribution design: ADR-0022.

## 6. Risks for an autonomous agent

### Hard guardrails — do not cross

- **Never `import` from `react`, `vue`, or any framework runtime in `packages/core/src/**`.**
  This is the load-bearing architectural invariant (ADR-0003); a sneaky transitive pull-in
  (e.g. via an adapter's `/config` entry leaking into the browser bundle) is exactly the bug
  ADR-0005 was created to prevent. Rule: `.copilot/rules/core-no-framework.md`.
- **Never reference `@doidor/markbook-adapter-vue` or `-wc` as if they exist.** They were removed
  from the tree (ADR-0028) to keep the public surface honest until they're actually built. Only
  `@doidor/markbook-adapter-react` exists today.
- **`BUILTIN_DIRECTIVES` (`story`, `stories`, `props`) are immutable.** `createContext` throws if
  `config.directives` tries to override one. Adding a fourth built-in is an ADR-level decision
  (see ADR-0025 for the user-directive design).
- **Don't expand `htmlTemplate` into a real templating engine.** It's deliberately
  substitution-only (no conditionals, no loops, no partials). Point users at Handlebars/ETA
  inside their handler instead.
- **Never bypass the pre-commit hook** (`pnpm lint && pnpm typecheck && pnpm test`). It is the
  baseline CI gate.

### Pre-existing automated hooks (Claude Code only, advisory)

`.claude/settings.json` wires three hooks. They cannot block commits but emit reminders an agent
should not ignore:
- `PostToolUse` on `Edit|Write` → `post-edit-reminder.mjs` — reminds to update PROGRESS when
  `/packages/` is edited.
- `Stop` → `stop-progress-check.mjs` — warns if `packages/**` changed but `PROGRESS.md` didn't.
- `Stop` → `stop-harness-check.mjs` — warns if public surface changed but no README / AGENTS /
  ROADMAP did.

### Areas with sharp edges (consult the wiki BEFORE editing)

`.copilot/wiki/` exists precisely to keep agents from re-discovering known gotchas:
- **`shadow-tokens-on-host-and-root`** — CSS tokens on `:root` only don't reach shadow-rooted
  mounts; pair with `:host`. Critical for embed bundles with `--isolation shadow`.
- **`playground-inline-source-imports`** — sandbox playgrounds need
  `playground.inlineSourceImports` globs.
- **`css-in-ts-template-literal`** — backticks/`${` inside CSS comments in TS template literals
  break the parser; surfaces as a Vitest "Transform failed" on a `.ts` file.
- **`vite-tmpdir-watching`** — Vite's watcher won't pick up files outside its `root`; chokidar
  handles user content separately.
- **`parallel-mkdir-then-create`** — `mkdir` + `create` in the same tool batch can race;
  serialize directory creation.
- **`html-layout-gotchas`** — layout files have strict placeholder validation (unknown / missing
  / duplicate `{{ content }}` all throw).
- **`biome-jsx-expression-in-html-templates`** — Biome treats `{{ }}` in `.html` as JSX text
  expressions; the `biome.json` `files.includes` already excludes `**/layouts/**/*.html` and
  `**/directives/**/*.html` — don't undo that.

### Generated, vendored, or symlinked surfaces — handle carefully

- **`CLAUDE.md` is generated by AgentRig** (banner at top: "Do not edit here — edit the source
  and run `agentrig compile`"). The source is `AGENTS.md` + `.agents/rules/`. Same applies to
  other AgentRig-touched files.
- **`.claude/rules`, `.claude/skills`, `.claude/wiki` are symlinks into `.copilot/`**, as are the
  same three subdirectories under `.codex/`, `.opencode/`, `.agents/`. The single source of
  truth is `.copilot/`. Editing the symlinked path is fine (it lands in `.copilot/`); deleting
  one of the symlinks accidentally would silently break the vendor surface for that client.
- **`.cursor/rules/` is a real directory** (not a symlink), so it can drift from `.copilot/`.
- **`packages/*/dist/`, `packages/*/tsconfig.tsbuildinfo`** — generated by `tsc -b`, never commit
  edits, ignored by Biome and `.gitignore`.
- **`examples/*/dist/`, `examples/*/.markbook/`** — generated by `markbook build` / `dev`,
  ignored by `.gitignore`.
- **`examples/*/.claude/skills/markbook-*/` etc.** — generated by `markbook skills install`,
  ignored by `.gitignore`. Canonical sources live at `packages/cli/skills/`; the installed
  copies are derivable artifacts.
- **`pnpm-lock.yaml`** — never hand-edit. Excluded from Biome. CI uses `--frozen-lockfile`, so
  any dep change requires regenerating it via `pnpm install`.

### Release / publish risks

- **Releases publish four packages in lockstep** (`fixed` group: `@doidor/markbook`,
  `@doidor/markbook-core`, `@doidor/markbook-adapter-react`, `@doidor/markbook-adapter-shared`).
  A changeset on any one bumps all four. `workspace:*` cross-refs get rewritten to the concrete
  version by pnpm at publish time.
- **Publishing is tokenless OIDC** — never add an `NPM_TOKEN` secret, never run
  `pnpm publish` / `npm publish` from a workstation. The Trusted Publisher must be configured
  per-package on npmjs.com (one-time setup; see `RELEASING.md`).
- **Allow GitHub Actions to create/approve PRs** must be enabled in repo settings for the
  Changesets "Version Packages" PR to open.

### CI-only test paths

`pnpm test` only covers `@doidor/markbook-core` and `@doidor/markbook` (cli) Vitest suites. The
example demo builds (React/static/marketing/site/bundle) are run by CI and the verify-build
skill, but they aren't part of `pnpm test`. **Don't claim "tests pass" without also running the
example builds** — many code paths (Vite orchestration, embed bundling, layout, custom
directives, fenced-code highlighting) only exercise end-to-end through an example.

### Things that look like flaky tests but aren't

Per `.copilot/skills/verify-build/SKILL.md`:
- Example build warning: "pagefind 404 / can't be bundled without type=module" — **cosmetic**.
  Pagefind assets are emitted post-bundle; the warning is expected and the build still produces
  a usable `dist/`.
- `Vite` build hangs / stale output → `rm -rf .markbook` to clear `tmpDir` and retry.

### Authorship boundary

This is a personal project under the `@doidor` npm scope, MIT licensed. The path
`/Users/doidor/src/microsoft/markbook` is the user's checkout location (Microsoft is the user's
employer); the repository itself is `github.com/doidor/markbook` and is not a Microsoft project.
Don't confuse the two.

---

_Investigation finished. Did not modify any other repo file._
