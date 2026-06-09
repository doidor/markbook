# `argument-hint:` values starting with `[` need YAML quoting

**Symptom:** Consumer agent CLIs (Claude Code, Codex, OpenCode, Cursor) reject one or more shipped Markbook skills at discovery time with:

```text
✖ .claude/skills/markbook-layout/SKILL.md: failed to parse YAML frontmatter:
  did not find expected key at line 5 column 30, while parsing a block
```

The CLI's own `markbook skills install` succeeds (it just copies bytes; doesn't parse YAML), so the bug ships unnoticed and only surfaces when a consumer agent tries to load the skill.

**Root cause:** A SKILL.md frontmatter value like

```yaml
argument-hint: [layout-name] [--style docs|marketing|blog|minimal] [--dest <layoutsDir>]
```

is interpreted as a YAML **flow sequence** `[layout-name]` followed by an invalid second flow sequence — YAML expected the next block-mapping key but found another `[`. The leading `[` triggers flow-sequence parsing because the value isn't quoted.

This only bites when:
- the value **starts** with `[` (not just contains it later — `<arg> [--flag]` is fine because the plain scalar runs to end-of-line)
- there is content **after** the first `]` (`[arg]` alone parses as a one-item sequence and doesn't error)

**Fix:** Quote any `argument-hint:` value that starts with `[`:

```yaml
# ❌ — YAML parses [layout-name] as a flow sequence, chokes on the next [
argument-hint: [layout-name] [--style docs|marketing|blog|minimal]

# ✅ — single quotes make it a plain string
argument-hint: '[layout-name] [--style docs|marketing|blog|minimal]'
```

Single quotes are sufficient (the values don't contain `'`). Double quotes work too but require backslash-escaping `\` and `"`.

**Prevention:**

- `packages/cli/src/skills.test.ts` has a test that loads every shipped SKILL.md frontmatter through `js-yaml` and asserts (a) it parses without error and (b) `argument-hint` round-trips as a string (catches the flow-sequence-parsed-as-array case). Don't merge a new shipped skill without running `pnpm --filter @doidor/markbook test`.
- Same rule applies to ANY frontmatter value starting with a YAML-significant character: `[`, `{`, `&`, `*`, `!`, `|`, `>`, `'`, `"`, `%`, `@`, `` ` `` — quote them.

**First observed:** 2026-06-09, when a user installed the agent skills into a different repo and got the failure from Claude Code at discovery time.
