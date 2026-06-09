---
title: Agent skills
description: Markbook ships first-class agent skills — scaffold, generate, theme, and bundle from inside Claude Code, Codex, OpenCode, Cursor, or any agent CLI that auto-discovers skills.
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

Markbook **detects which surfaces exist** (`.claude/`, `.codex/`, `.opencode/`, `.agents/`) and copies skill content into each. Each skill lands at `<surface>/skills/markbook-<name>/SKILL.md` (flat namespace, cross-vendor portable).

```bash
npx markbook skills install --surface .codex   # limit to one surface
npx markbook skills install --update           # refresh after upgrading markbook
npx markbook skills list                       # see installed + drift state
```

:::callout{type=tip}
**Already use AGENTS.md / CLAUDE.md / a custom agent rules file?** Add a line like _"Run /markbook-init to set up docs"_ — once the skills are installed, your agent will pick them up automatically. No further config.
:::

## The six skills at a glance

| Skill | What it does |
| --- | --- |
| **`markbook-init`** | 🆕 Scaffold a new site (`markbook.config.ts`, sample page, example story, suggested package scripts). Refuses to clobber. |
| **`markbook-add-component-page`** | 📄 Generate one docs page (frontmatter + `:::props` + `:::stories`) for a single component file. |
| **`markbook-bulk-generate`** | 📦 Scan a directory, dry-run by default, generate pages for every component-like file. `--write` actually writes. |
| **`markbook-style`** | 🎨 Apply a visual preset (`minimal` / `vibrant` / `corporate` / `github` / `nord`). Optional `--accent` / `--font` overrides. |
| **`markbook-layout`** | 🏗️ Scaffold a custom HTML layout (`docs` / `marketing` / `blog` / `minimal`) with required placeholders pre-wired. |
| **`markbook-bundle-story`** | 📤 Walk through `markbook bundle` for embedding a story externally. Picks `embed` or `package` mode and prints the snippet. |

**For every flag of every skill**, see the [skills reference →](../reference/skills.html).

## Why agent-first?

Three reasons we made skills a first-class output of the build, not a docs page somewhere:

1. **Docs sites are forgettable infra.** Most teams set one up once and never touch it again. That setup-once cost — config file, sample page, story scaffold, theming — is exactly what agents are best at.
2. **Discoverability beats documentation.** `/markbook-style github` is less friction than "edit `markbook.config.ts`'s `css:` field, write a CSS file with token overrides like `--mb-accent`…" The agent shouldn't need to read a guide — the procedure is the guide.
3. **Conventions, encoded.** Every skill has "prevention tests" that catch common mistakes. The agent doesn't have to guess that `:::story{src=./X.stories.tsx}` is the right shape vs `<Story src=...>`. The skill knows.

Markbook still works perfectly as a hand-edit-the-config tool — every skill is a wrapper around the same `markbook.config.ts` and `pages/` you'd write by hand.

## Customizing the shipped skills

When `markbook skills install` copies a skill, it copies the entire skill directory — `SKILL.md` plus any `presets/`, `templates/`, or other resource files. Edit your local copy freely; `markbook skills install --update` will flag drift and ask before overwriting. To upstream a change, PR against [`packages/cli/skills/`](https://github.com/doidor/markbook/tree/main/packages/cli/skills).

## What's next

- [Skills reference →](../reference/skills.html) — every flag of every skill
- [Adding component stories →](./adding-stories.html) — what `markbook-bundle-story` bundles
- [Customization →](./customization.html) — the four-layer model that `markbook-style` and `markbook-layout` operate inside
