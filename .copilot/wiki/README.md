# Wiki (cumulative gotchas)

Captures lessons learned. When something surprising trips up an agent (or a
human), record the gotcha here so the next investigator doesn't re-discover it.

## Format

```
.copilot/wiki/<topic>.md
```

Each entry has four sections — short, concrete, no preamble:

```md
# <Short title — what happened>

**Symptom:** what the agent saw

**Root cause:** what was actually broken

**Fix:** what made it work

**Prevention:** how to avoid hitting it again (link to a skill or rule if applicable)
```

## Admission tests

A new wiki entry must:

1. **Describe a real failure**, not a speculative one. "We hit X this session, and it took Y minutes to figure out" is admissible.
2. **Not duplicate** an existing entry. If a close entry exists, add a section to it instead of creating a new file.
3. **Have a single root cause**. If a session hit three unrelated issues, write three entries.
4. **Suggest prevention**. Either: link to an existing skill/rule that would have prevented it, OR propose a new skill/rule (and write it).

## Catalogue

| Topic | What |
| --- | --- |
| [`shadow-tokens-on-host-and-root`](shadow-tokens-on-host-and-root.md) | CSS tokens declared on `:root` only don't reach shadow-rooted mounts — pair with `:host` |
| [`playground-inline-source-imports`](playground-inline-source-imports.md) | Sandboxes need `playground.inlineSourceImports` globs to include in-repo source files |
| [`css-in-ts-template-literal`](css-in-ts-template-literal.md) | Backticks in CSS comments inside a TS template literal break parsing |
| [`vite-tmpdir-watching`](vite-tmpdir-watching.md) | Vite's watcher won't pick up files outside its `root`; chokidar handles user content |
| [`parallel-mkdir-then-create`](parallel-mkdir-then-create.md) | `mkdir` and `create` in the same tool batch can race; serialize directory creation |
| [`html-layout-gotchas`](html-layout-gotchas.md) | HTML layout authoring — required placeholders, strict validation, escaping, comment preservation |
| [`biome-jsx-expression-in-html-templates`](biome-jsx-expression-in-html-templates.md) | Biome's HTML linter treats `{{ }}` placeholders in `.html` files as JSX text expressions — exclude the templating directory in `biome.json` |
| [`align-self-on-fixed-children`](align-self-on-fixed-children.md) | `align-self: start` cascades through `position: fixed`, collapsing the element to intrinsic height — explicitly reset `align-self: stretch` in the media-query rule |
| [`yaml-frontmatter-bracket-values`](yaml-frontmatter-bracket-values.md) | SKILL.md `argument-hint:` values starting with `[` get parsed as YAML flow sequences — quote them as a string |

## Session-end discipline

At the end of a session that ran into trouble, log the outcome with one of:

- `Wiki updated` — added a new entry
- `existing entry covered it` — found and applied a relevant entry
- `no new gotcha` — clean session, nothing to add

This is the equivalent of writing a brief post-mortem. It costs ~60 seconds
and compounds over time.
