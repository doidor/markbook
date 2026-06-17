# @doidor/markbook

## 0.4.0

### Patch Changes

- Updated dependencies [[`65a9def`](https://github.com/doidor/markbook/commit/65a9defbaca630bc09d1ba7dbe3b7a1cb9c30130)]:
  - @doidor/markbook-core@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [[`d0b2752`](https://github.com/doidor/markbook/commit/d0b27526ccc138aafa3ec335f3db956b1a7c03b4)]:
  - @doidor/markbook-core@0.3.0

## 0.2.0

### Patch Changes

- [#12](https://github.com/doidor/markbook/pull/12) [`0851ec8`](https://github.com/doidor/markbook/commit/0851ec8ca59a151ce6585f4256f7b662e259bbdc) Thanks [@doidor](https://github.com/doidor)! - Fix YAML frontmatter in `markbook-layout` and `markbook-style` SKILL.md
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

- [#10](https://github.com/doidor/markbook/pull/10) [`12305e4`](https://github.com/doidor/markbook/commit/12305e4bf2b85ef5a68b029d7cbc41202e8e29d3) Thanks [@doidor](https://github.com/doidor)! - Add the AgentRig agent harness (`npx @doidor/agentrig init --skip-agent`).
  Non-destructively layers the canonical agentrig artifacts on top of the
  existing markbook harness: `.agentrig/` (PRINCIPLES, harness state machine,
  role prompts, eval rubric/dashboard), six canonical skills + four reflex rules
  - wiki scaffolding under `.copilot/` (reachable via the existing `.agents/`
    symlinks), MCP config (`.mcp.json`, `.vscode/mcp.json`, `.github/copilot/mcp.json`),
    and Cursor/Copilot/Codex/OpenCode/Claude surface projections via `agentrig
compile`. Markbook's curated `AGENTS.md` and vendor mirrors are preserved
    (only `CLAUDE.md` regenerates from `AGENTS.md`). Biome ignores the
    agentrig-owned dirs. Harness score: 100%.
- Updated dependencies [[`0851ec8`](https://github.com/doidor/markbook/commit/0851ec8ca59a151ce6585f4256f7b662e259bbdc)]:
  - @doidor/markbook-core@0.2.0

## 0.1.2

### Patch Changes

- [#8](https://github.com/doidor/markbook/pull/8) [`2ea31d5`](https://github.com/doidor/markbook/commit/2ea31d58f8a1780af0895e36950f074e015eba6c) Thanks [@doidor](https://github.com/doidor)! - Adopt Changesets for releases. `pnpm changeset` records changes; merging the
  auto-opened "Version Packages" PR publishes all four `@doidor/markbook*`
  packages in lockstep, tokenlessly via OIDC trusted publishing. The previous
  GitHub-Release-triggered flow and the `release:version` helper are removed.
- Updated dependencies []:
  - @doidor/markbook-core@0.1.2
