# AGENTS.md

> **Instructions in this file are the source of truth, not existing code.**
> When code patterns and this file disagree, follow this file and update the
> code.

This file is loaded by Codex / OpenCode / Cursor / Copilot CLI / Claude Code
(via [`CLAUDE.md`](CLAUDE.md) which points here). It is the authoritative agent
constitution for the repo.

## Critical Rules

1. **Markdown is the source of truth.** HTML and `llms.txt` are two views of one AST. Never add features that put authoring content outside `.md` (no MDX, no JSON sidecars).
2. **No framework code in `@markbook/core`.** React, Vue, web-components runtime concerns live in their adapter packages. Core knows about markdown, directives, Vite orchestration, embed bundling — nothing else. Enforced by `.copilot/rules/core-no-framework.md`.
3. **Public API surface is `index.ts` only.** Anything reachable solely via `internal.ts` (or by deep import from a `.test.ts`) may change in any minor release. Tests import from sibling source modules, not the barrel — keep it that way.
4. **Verify before handoff.** Before claiming a change is done, run the [`/verify-build`](.copilot/skills/verify-build/SKILL.md) cycle. Iteration cap N=3 on the same failure — beyond that, self-park rather than churn.
5. **Every user-facing or architectural change updates `PROGRESS.md`.** Use the [`/progress-log`](.copilot/skills/progress-log/SKILL.md) skill. For non-obvious decisions also add an ADR in `DECISIONS.md`. Update affected READMEs in the SAME commit.
6. **One logical change per commit.** Co-author trailer required:
   `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
7. **Authoring stays simple.** A user with a markdown file and a story file should be able to run one command. Fight scope creep that adds config burden.

## Where to look first

| Question | Look here |
| --- | --- |
| "How do I do X?" | `.copilot/skills/` (mirrored as `.claude/skills/`, `.codex/skills/`, etc.) |
| "What's the rule for editing files of type Y?" | `.copilot/rules/` |
| "Has this gotcha been seen before?" | `.copilot/wiki/` |
| "Why was this designed this way?" | `DECISIONS.md` (ADRs) |
| "What changed and when?" | `PROGRESS.md` (append-only journal) |
| "What's planned next?" | `ROADMAP.md` |
| "What's the package's public API?" | `packages/<name>/README.md` |
| "How is the repo structured?" | `README.md` (directory map at the bottom) |
| "How do I customize a Markbook site's chrome?" | Four layers in `packages/core/README.md`: `css` → `disableBaseCss` → `layoutsDir` → `transformHtml`. Worked example in `examples/marketing-demo/`. |
| "How do I register a custom directive?" | `config.directives` from `markbook.config.ts`. See `examples/markbook-site/pages/guides/custom-directives.md` for the public guide, ADR-0025 for the design rationale, and `examples/markbook-site/directives/callout.{ts,html}` for the canonical pattern (handler in `.ts`, output markup in a `.html` template loaded by `htmlTemplate(new URL('./x.html', import.meta.url))`). |
| "How do I emit HTML markup from a directive handler without inline template literals?" | `htmlTemplate(source)` in `@markbook/core`. Sync-load-once-cached `{{ key }}` + `{{ key.dot.path }}` substitution from a vars map; raw insertion (no auto-escape — matches the layout-placeholder contract); HTML comments preserved. Demoed in `examples/markbook-site/directives/callout.{ts,html}`. |
| "How do I control sidebar order?" | Frontmatter `order: <number>` on the page (lower = earlier). Ordered pages appear before unordered; same-order pages preserve file-discovery order; the index page is always first regardless. See `examples/markbook-site/pages/guides/getting-started.md` for the canonical use. |
| "Where does syntax highlighting / the copy button on fenced code blocks come from?" | `packages/core/src/fenced-code.ts` — an async rehype transformer wired into the main pipeline + `renderChildrenToHtml`. Reuses the same Shiki dual-theme config as story disclosures (`themes: { light: 'github-light', dark: 'github-dark' }`, `defaultColor: false`) so `[data-theme]` swap re-paints colors. Wraps every `<pre><code>` with `<div class="markbook-code-pre-wrap markbook-fenced-code">` + the shared `[data-markbook-copy]` button (boot script in `build.ts:COPY_BOOT_SCRIPT`). |

## Directory map

```
AGENTS.md            ← this file (canonical agent conventions)
CLAUDE.md            ← thin pointer at AGENTS.md
README.md            ← repo entry for humans
PROGRESS.md          ← append-only journal (use /progress-log)
DECISIONS.md         ← ADRs for non-obvious choices
ROADMAP.md           ← forward-looking work
packages/
  core/      AGENTS.md README.md   ← engine (markdown + directives + Vite + embed)
  cli/                  README.md   ← markbook binary (thin wrapper around core)
  adapter-react/  AGENTS.md README.md
  adapter-vue/          README.md
  adapter-wc/           README.md
  adapter-shared/       README.md   ← shared browser runtime for the adapters (ADR-0026)
examples/
  react-demo/                       ← Pixie component library (canonical dogfood)
  vue-demo/  wc-demo/               ← framework-agnostic proofs
  static-demo/                      ← markdown-only docs site (no adapter)
  marketing-demo/                   ← marketing site via disableBaseCss + layouts/
  markbook-site/                    ← the official Markbook website (markdown-only,
                                       hybrid layout, custom :::callout directive
                                       under directives/callout.{ts,html})
  embed-host/                       ← external consumer of embed/package bundles
.copilot/                           ← canonical agent surface (skills/rules/wiki)
.claude/.codex/.opencode/.agents/   ← vendor mirrors (symlinks into .copilot)
.github/workflows/ci.yml            ← lint / typecheck / build / test / examples
```

## Adding a skill, rule, or wiki entry

This repo has **two skill categories** — pick the right one:

- **Contributor skills** (`.copilot/skills/<name>/SKILL.md`) — for developing Markbook itself. Loaded when an agent is working inside the Markbook source tree; mirrored into `.claude/`, `.codex/`, `.opencode/`, `.agents/` via symlinks. Examples: `add-stories`, `verify-build`, `progress-log`.
- **User-facing skills** (`packages/cli/skills/<name>/SKILL.md`) — shipped inside the published `markbook` npm package. Consumers install them via `markbook skills install`; they land at `<vendor>/skills/markbook-<name>/` in the consumer's repo. Examples: `init`, `bulk-generate`, `style`. See [ADR-0022](DECISIONS.md) for the distribution design.

A **skill** is procedural: "how to do X." Write one when you find yourself doing the same multi-step thing twice. Format: SKILL.md with YAML frontmatter (`name`, `description`, `trigger`).

A **rule** is reflexive: "when editing files matching `<glob>`, always/never do X." Format: `.copilot/rules/<name>.md` with YAML frontmatter (`glob`, `priority`). Keep rules short — if a rule grows past one screen, convert it into a skill.

A **wiki entry** captures a gotcha: "we hit X, the cause was Y, the fix is Z, the prevention is W." Format: `.copilot/wiki/<topic>.md`. Admission test in `.copilot/wiki/README.md` (no duplication, single-fix focus).

## Existing tooling

- `.claude/commands/` — Claude Code slash commands (now empty; legacy `markbook-log` replaced by the `/progress-log` skill)
- `.claude/hooks/post-edit-reminder.mjs` — `PostToolUse` reminder when editing `packages/**`
- `.claude/hooks/stop-progress-check.mjs` — `Stop` warning when packages/** changed but PROGRESS didn't
- `.claude/settings.json` — wires the hooks

These hooks are still correct and active.
