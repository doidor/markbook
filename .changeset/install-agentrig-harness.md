---
"@doidor/markbook": patch
---

Add the AgentRig agent harness (`npx @doidor/agentrig init --skip-agent`).
Non-destructively layers the canonical agentrig artifacts on top of the
existing markbook harness: `.agentrig/` (PRINCIPLES, harness state machine,
role prompts, eval rubric/dashboard), six canonical skills + four reflex rules
+ wiki scaffolding under `.copilot/` (reachable via the existing `.agents/`
symlinks), MCP config (`.mcp.json`, `.vscode/mcp.json`, `.github/copilot/mcp.json`),
and Cursor/Copilot/Codex/OpenCode/Claude surface projections via `agentrig
compile`. Markbook's curated `AGENTS.md` and vendor mirrors are preserved
(only `CLAUDE.md` regenerates from `AGENTS.md`). Biome ignores the
agentrig-owned dirs. Harness score: 100%.
