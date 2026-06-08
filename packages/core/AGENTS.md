# `@doidor/markbook-core` — AGENTS.md

Package-specific rules for the engine. See [`/AGENTS.md`](../../AGENTS.md) for repo-wide Critical Rules and [`README.md`](README.md) for the public API.

## Package-specific rules

1. **No framework imports.** Never `import` from `react`, `vue`, `@vue/...`, or any framework runtime in `src/`. Enforced by [`.copilot/rules/core-no-framework.md`](../../.copilot/rules/core-no-framework.md). If you need framework behaviour, expose a hook on `MarkbookAdapter` instead.
2. **`index.ts` is the public contract; `internal.ts` is everything else.** New symbols default to `internal.ts`. Promoting an export from `internal.ts` to `index.ts` is a deliberate API decision — add an ADR.
3. **Tests import from sibling source modules.** `import { parseMarkdown } from './parse.js'` — not from the barrel. Keeps the API split honest.
4. **AST work prefers the TS compiler API over regex.** It's a direct dep (used in `code.ts`, `exports.ts`, transitively in `props.ts`). Regex is acceptable for trivial scans (e.g. surfacing sibling CSS imports) but semantic work walks the AST.
5. **Caches need invalidators.** Any in-module `Map` cache must export an `invalidateXCache(absPath?)` function so `dev` mode HMR can wipe stale entries. The one current exception is `htmlTemplate`'s module-level template cache — it's intentionally permanent for the process lifetime because directive templates are config-tree files (rebuild restarts the process); if that ever changes, add an invalidator.
6. **Built-in directives (`story`, `stories`, `props`) are immutable.** `BUILTIN_DIRECTIVES` (exported from `index.ts`) is the canonical set; `createContext` throws if `config.directives` tries to override any of them. Don't widen the user-directive surface to overlap these names — adding a new built-in directive is an ADR-level decision (see ADR-0025).
7. **Public directive utilities (`escapeHtml`, `escapeAttribute`, `htmlTemplate`) are tiny on purpose.** They're meant to be enough for user-authored handlers without pulling in a templating dep. Resist the urge to add conditionals/loops/partials to `htmlTemplate` — direct users to a real templating library (Handlebars, ETA, etc.) called from inside their handler instead.

## Common skills

- [`/verify-build`](../../.copilot/skills/verify-build/SKILL.md) — pre-handoff verify
- [`/progress-log`](../../.copilot/skills/progress-log/SKILL.md) — append PROGRESS entry
- [`/add-stories`](../../.copilot/skills/add-stories/SKILL.md) — exercise the parser end-to-end via a dogfood page
