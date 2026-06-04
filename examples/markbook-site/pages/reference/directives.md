---
title: Markdown directives
description: The custom :::directives Markbook recognizes for stories, props tables, and more.
---

# Markdown directives

Markbook understands a few [`remark-directive`](https://github.com/remarkjs/remark-directive) blocks beyond standard markdown. Each one looks like:

```markdown
:::name{key=value other=value}
:::
```

## `:::story` — one story per file

Mount a single component story.

```markdown
:::story{src=./Button/Primary.stories.tsx}
:::
```

| Attribute | Required | Purpose |
| --- | --- | --- |
| `src` | yes | Path to the story file (relative to the markdown page, or a bare specifier like `@my-org/stories/Button`). |
| `export` | no | Named export within the file. Defaults to `default`. |
| `id` | no | Stable bundle slug override (used by `markbook bundle`). Defaults to a kebab-case path. Set this if you rename files but want external embeds to keep working. |

The story file's default export is the story (a component, or a CSF v3 object with `render`/`args`/`argTypes`/`parameters`). See [adding stories →](../guides/adding-stories.html) for the workflow.

## `:::stories` — multiple exports from one file

Mount every named export from a CSF v3 story file as a grid of cards.

```markdown
:::stories{src=./Button/Button.stories.tsx}
:::
```

Markbook walks the file's TypeScript AST to find runtime exports, skips type-only exports + reserved names (`default`, `args`, `argTypes`, `parameters`), and renders one card per remaining export with its humanized name.

## `:::props` — generated props table

Render a table of every prop in a React component, generated from its TypeScript types via `react-docgen-typescript`. React-only.

The component is named in the page's frontmatter:

```markdown
---
title: Button
component: ../../src/Button.tsx
componentExport: Button
---

## Props

:::props
:::
```

| Frontmatter field | Required | Purpose |
| --- | --- | --- |
| `component` | yes | Path to the component file (relative to page, or bare specifier). |
| `componentExport` | no | Named export within the component file. Defaults to `default`. |

The directive renders a table of `{ Name, Type, Default, Description }` for every prop. The same table is mirrored into the page's `llms/<page>.txt` so LLMs see the props too.

## Attribute syntax

Directive attributes use the standard remark-directive format:

```markdown
:::story{src=./Foo.stories.tsx export=Primary id=my-button}
:::
```

- Unquoted values are allowed for values without spaces.
- Quoted values for spaces: `attr="value with space"`.
- Boolean attributes (key with no value) are not currently used by any directive.

## Skipping directives

A directive with a missing required attribute is rendered as an empty placeholder (no error). A directive Markbook doesn't recognize is rendered as-is (HTML for the directive's content). This is deliberate — Markbook doesn't claim to own the entire directive vocabulary; you can use other remark-directive consumers alongside it.
