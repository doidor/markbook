# Feature spec: `sortNavItems(items)`

Implement a function `sortNavItems(items)` that sorts an array of Markbook-style
sidebar nav items.

Also export the helper `isIndexHref(href)` (used by the contract clauses below).

## Shape of an item

```js
{
  id: string,           // e.g. "guides/getting-started"
  title: string,        // human-readable label
  htmlRelPath: string,  // e.g. "guides/getting-started.html" or "index.html"
  order?: number,       // optional frontmatter `order:` field
}
```

## Where to put it

Export both functions from `src/nav.js`. The acceptance tests in
`src/nav.test.js` import them from there.

## Sort contract

`sortNavItems(items)` returns a **new** array (does **not** mutate the input)
in the following order:

1. **Index pages always come first.** A nav item is an "index page" iff
   `isIndexHref(item.htmlRelPath)` returns `true`. `isIndexHref(href)` returns
   `true` when `href === "index.html"` OR `href.endsWith("/index.html")`. This
   rule wins over `order:` — an index page with `order: 999` still sorts first;
   a non-index page with `order: -100` still comes after it.
2. **Ordered pages come before unordered pages.** A page is "ordered" if its
   `order` field is `!== undefined`; otherwise it is "unordered".
3. **Ordered pages sort ascending by `order`.** (Lower `order` first.)
4. **Ties on `order` fall back to file-discovery order.** If two pages share
   the same `order`, the one that appears earlier in the input array sorts
   first.
5. **Unordered pages preserve file-discovery order.** Adding `order:` to one
   sibling must **not** silently reshuffle the rest. Concretely: input
   `[c, a, b]` (all unordered) returns `[c, a, b]`, **not** alphabetical
   `[a, b, c]`.
6. **The input array is not mutated.** Repeat the same `sortNavItems` call
   on the same input and you must observe identical input contents before
   and after; the returned array must be a distinct reference.

## Worked examples

| Input (file-discovery order) | Output |
| --- | --- |
| `[{a, order: 2}, {b, order: 1}]` | `[{b, order: 1}, {a, order: 2}]` |
| `[{guide}, {index}, {api}]` (no order) | `[{index}, {guide}, {api}]` |
| `[{a, order: -100}, {index, order: 999}]` | `[{index, order: 999}, {a, order: -100}]` |
| `[{first, order: 5}, {second, order: 5}]` | `[{first, order: 5}, {second, order: 5}]` |
| `[{c}, {a}, {b}]` (no order) | `[{c}, {a}, {b}]` |
