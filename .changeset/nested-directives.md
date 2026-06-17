---
"@doidor/markbook-core": minor
---

**Nested directives now compose inside container bodies** (#20).

Leaf and container directives written inside a `:::` container are resolved
through their handlers instead of rendering as empty `<div>` elements:

```md
:::section{label=Currently}
::about-item{label="Role:" text="Principal Engineer"}
::about-item{label="Team:" text="Core"}
:::
```

The `section` handler receives each `about-item`'s rendered output as
`innerHtml`. Containers nest too (add more colons to the outer fence, like
nested code fences). Nested-handler `dependencies` roll up into the page's
dev-mode watch set, and a thrown nested handler is wrapped with the same
`file:line:col` context as a top-level one. Built-in directives
(`story` / `stories` / `props`) remain top-level only.

Also fixes a latent bug where `innerMarkdown` returned the page's frontmatter
text (instead of the container body) when frontmatter was present — offsets
now index the frontmatter-stripped content.

Directives are still not parsed inside raw HTML blocks (`<ul>…</ul>`) — that's
a CommonMark rule; use a container directive (e.g. a `link-list` wrapping
`link` children) to build the same structure.
