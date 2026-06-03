# Skills

Procedural memory: each skill encodes how to do one thing well. Skills are
auto-discovered from `.copilot/skills/` and from every mirrored vendor surface
(`.claude/skills/`, `.codex/skills/`, `.opencode/skills/`, `.agents/skills/`).

## Format

```
.copilot/skills/<name>/SKILL.md
```

Each `SKILL.md` opens with YAML frontmatter:

```yaml
---
name: skill-name
description: One-line summary in present tense.
trigger: When user says "X" or works on Y.
allowed-tools: Bash Read Grep Glob Edit Create  # optional, narrows blast radius
argument-hint: <optional CLI-style hint>        # optional
---
```

Body is the procedural instructions: numbered steps the agent follows verbatim.
Skills should end with a **Prevention tests** section listing what conditions
the new skill would have caught — admission test for the skill itself.

## Catalogue

| Skill | Purpose |
| --- | --- |
| [`add-stories`](add-stories/SKILL.md) | Scaffold a multi-export `.stories.tsx` and wire it via `:::stories` |
| [`bundle-story`](bundle-story/SKILL.md) | Produce + smoke-test an embed bundle |
| [`progress-log`](progress-log/SKILL.md) | Append a PROGRESS.md entry (replaces the legacy `/markbook-log` slash command) |
| [`verify-build`](verify-build/SKILL.md) | Pre-handoff verify loop (lint → typecheck → test → build → demos), iteration cap N=3 |

## Adding a skill

Write it when you find yourself doing the same multi-step thing twice. The
skill's existence must be justified by a concrete past failure or repeated
manual work — speculative skills bloat the surface.
