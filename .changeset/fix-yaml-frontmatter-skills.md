---
"@doidor/markbook": patch
---

Fix YAML frontmatter in `markbook-layout` and `markbook-style` SKILL.md
files. The `argument-hint:` value started with `[` which YAML parsers
interpret as a flow sequence, breaking skill discovery in consumer agent
CLIs (Claude Code, Codex, OpenCode, Cursor) with `did not find expected
key`. Values are now single-quoted so they parse as strings.

Added a prevention test (`skills.test.ts`) that loads every shipped
SKILL.md frontmatter through `js-yaml` and asserts (a) it parses without
error, (b) `argument-hint` round-trips as a string — this catches the
exact failure mode the previous regex-based presence check missed.

**Consumers who already ran `markbook skills install`:** after upgrading,
run `markbook skills install --update` to pick up the fixed SKILL.md
files.
