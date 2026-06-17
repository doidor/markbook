---
"@doidor/markbook-core": patch
---

**Resolve nested directive markdown fallbacks in a container's `innerMarkdown`** (#30).

The HTML path already resolved nested directives (#20), but `innerMarkdown` still
held the raw `::name{...}` source — so a container handler that built its
`markdown` fallback from `innerMarkdown` leaked unresolved directive syntax into
the `llms/<page>.txt` mirror.

Now `innerMarkdown` substitutes each nested directive's `markdown` fallback (same
recursion + contract as `innerHtml`):

```md
:::section{label=Currently}
::about-item{label="Role:" text="Principal Engineering Manager"}
:::
```

With `about-item` returning `{ html, markdown: '**Role:** …' }`, the section's
`innerMarkdown` is now `**Role:** Principal Engineering Manager` instead of the
literal `::about-item{...}`. Nested containers compose recursively; a nested
directive that returns no `markdown` keeps its raw source (same as top-level),
and `markdown: ''` drops it.
