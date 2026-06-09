---
title: Agent skills
description: Markbook ships first-class agent skills — scaffold, generate, theme, and bundle from inside Claude Code, Codex, OpenCode, Cursor, or any other agent CLI that auto-discovers skills.
order: 2
---

# Agent skills

Markbook is **agent-first by default**. The `markbook` npm package ships six procedural skills designed for AI coding agents — Claude Code, Codex, OpenCode, Cursor, Copilot CLI, and anything else that auto-discovers skills from `.claude/`, `.codex/`, `.opencode/`, or `.agents/`.

These aren't an afterthought. They're how we expect most Markbook setups to happen:

```text
You:    "Set up Markbook in this project."
Agent:  *runs /markbook-init*    → markbook.config.ts + first page
You:    "Generate docs for every component under src/components."
Agent:  *runs /markbook-bulk-generate --from src/components*
You:    "Apply the github preset, accent #0969da."
Agent:  *runs /markbook-style github --accent '#0969da'*
You:    "Embed the Button story on our marketing page."
Agent:  *runs /markbook-bundle-story button-primary*
```

No `markbook.config.ts` to hand-edit. No directives to memorise. The agent already knows.

## Install

After installing the `markbook` package, drop the shipped skills into your project's agent vendor surfaces:

```bash
npx markbook skills install
```

Markbook **detects which surfaces exist** (`.claude/`, `.codex/`, `.opencode/`, `.agents/`) and copies skill content into each. If you don't have any yet, it defaults to `.claude/`. Limit it to one surface with `--surface`:

```bash
npx markbook skills install --surface .codex
```

Each skill lands at `<surface>/skills/markbook-<name>/SKILL.md` (flat namespace, cross-vendor portable). A `.markbook-skill.json` sidecar records the content hash + markbook version so `--update` is deterministic:

```bash
npx markbook skills install --update     # refresh after upgrading markbook
npx markbook skills list                 # see which are installed + drift state
```

> See the [skills reference](../reference/skills.html) for every flag, or the [`markbook skills` CLI reference](../reference/cli.html#markbook-skills-install).

:::callout{type=tip}
**Already use AGENTS.md / CLAUDE.md / a custom agent rules file?** Add a line like _"Run /markbook-init to set up docs"_ — once the skills are installed, your agent will pick them up automatically. No further config.
:::

## The six skills

### `markbook-init` — scaffold a new site

🆕 Generates the minimum viable Markbook setup in the current project: `markbook.config.ts`, a sample home page, an example story, and the suggested `package.json` scripts. Refuses to clobber existing files. Pre-checks for React (`react` / `react-dom` in `package.json`) and offers to install missing deps.

```text
/markbook-init
```

Best for: a fresh project where Markbook isn't set up yet.

### `markbook-add-component-page` — one page for one component

📄 Generate one Markbook docs page (frontmatter + `:::props` + `:::stories`) for a single component file. Resolves the component, detects the primary export, extracts the JSDoc summary as the page description, and scaffolds a sibling stories file with a `Default` export.

```text
/markbook-add-component-page src/components/Button.tsx
```

Best for: incrementally documenting one component at a time. Pairs with `markbook-bulk-generate` for the bulk case.

### `markbook-bulk-generate` — pages for a whole directory

📦 Scans a directory, identifies component-like files (PascalCase exports returning JSX), and **dry-runs by default** — produces a candidate list for confirmation before writing anything. Pass `--write` to actually generate.

```text
/markbook-bulk-generate --from src/components               # dry-run
/markbook-bulk-generate --from src/components --write       # actually write
```

Heuristics are deliberately **conservative**: prefers false negatives over noise. Skipped files come with explanations ("no JSX returned", "test file", etc.).

Best for: turning an existing component library into a Markbook site in one shot.

### `markbook-style` — apply a visual preset

🎨 Five pre-baked presets (`minimal` / `vibrant` / `corporate` / `github` / `nord`) — each a self-contained CSS file that overrides Markbook's `--mb-*` design tokens for both light and dark modes. Optional `--accent` and `--font` overrides on top of any preset.

```text
/markbook-style vibrant
/markbook-style github --accent '#0969da'
/markbook-style minimal --font '"JetBrains Sans", system-ui'
```

The skill writes `./markbook.css` and wires it into `markbook.config.ts`'s `css:` field automatically. Re-runs detect-and-overwrite cleanly. Open the generated `markbook.css` and edit any `--mb-*` token to customise further.

Best for: getting from default-purple to your brand in 30 seconds without writing CSS.

### `markbook-layout` — scaffold a custom HTML layout

🏗️ Generates an HTML layout (`docs` / `marketing` / `blog` / `minimal` template) with all required `{{ }}` placeholders pre-wired, and registers it in `markbook.config.ts`. Pass `--set-default` to apply it site-wide; without it, only pages with matching `layout: <name>` frontmatter pick it up.

```text
/markbook-layout landing --style marketing
/markbook-layout default --style docs --set-default
```

Best for: stepping beyond the built-in shell into a marketing landing, a blog post template, or any chrome that isn't docs-shaped. See the [Customization guide](./customization.html) for the four-layer escalation ladder.

### `markbook-bundle-story` — embed a story externally

📤 Walk through `markbook bundle` for embedding a Markbook story on an external page (marketing site, blog post, partner docs). Picks the right mode (`embed` for one-click, `package` for npm-publishable), generates the bundle, and prints the exact HTML snippet to paste on the host page.

```text
/markbook-bundle-story button-primary
/markbook-bundle-story button-primary --mode package
/markbook-bundle-story button-primary --isolation shadow
```

Best for: pushing a live component example onto a page that isn't part of your docs site. See the [bundling section of adding stories](./adding-stories.html#exporting-stories-as-portable-bundles) for the underlying CLI.

## Why agent-first?

Three reasons we made skills a first-class output of the build, not a docs page somewhere:

1. **Docs sites are forgettable infra.** Most teams set one up once and never touch it again. The setup-once cost — config file, sample page, story scaffold, theming — is exactly what agents are best at.
2. **Discoverability beats documentation.** A markdown guide that says "to apply a theme, edit `markbook.config.ts`'s `css:` field, write a CSS file with token overrides like `--mb-accent`..." is more friction than `/markbook-style github`. The agent shouldn't need to read a guide — the procedure is the guide.
3. **Conventions, encoded.** Every skill has "prevention tests" — checks that catch the common mistakes. The agent doesn't have to guess that `:::story{src=./X.stories.tsx}` is the right shape (vs `:::story src=...` or `<Story src=...>`). The skill knows.

Markbook still works perfectly as a hand-edit-the-config tool — every skill is a wrapper around the same `markbook.config.ts` and `pages/` you'd write by hand. The agent path just makes the common workflows one-line.

## Customizing the shipped skills

When `markbook skills install` copies a skill, it copies the entire skill directory — `SKILL.md` plus any `presets/`, `templates/`, or other resource files. You can:

- **Edit the local copy.** Tweak the skill prose, add project-specific examples, change defaults. `markbook skills install --update` will then flag your copy as drifted and ask before overwriting.
- **Add new presets** to `markbook-style` by copying `presets/*.css` and editing the token overrides. The skill auto-discovers `presets/<name>.css` files.
- **Symlink instead of copy** with `--symlink` if you want the skill to track upstream automatically (avoid on Windows and pnpm).

To contribute a change back, open a PR against [`packages/cli/skills/`](https://github.com/doidor/markbook/tree/main/packages/cli/skills).

## What's next

- [Skills reference →](../reference/skills.html) — every flag of every skill
- [`markbook skills` CLI reference →](../reference/cli.html#markbook-skills-install) — install / list flags
- [Adding component stories →](./adding-stories.html) — context for what `markbook-bundle-story` bundles
- [Customization →](./customization.html) — the four-layer model `markbook-style` and `markbook-layout` operate inside
