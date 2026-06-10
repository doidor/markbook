# Judge brief — implement-frontmatter-order-sort (DO NOT SHOW TO PRODUCER)

## What's planted

- `fixture/SPEC.md` describes `sortNavItems(items)` with four ordering clauses
  + an immutability guarantee. The semantics are verbatim from Markbook's
  real `packages/core/src/nav.ts` (`sortNavItems` + `isIndexHref`).
- `fixture/src/nav.js` is a stub that throws `"sortNavItems: not implemented yet"`.
- `fixture/src/nav.test.js` has 8 acceptance tests, all `test.skip(...)`.

## What a correct implementation looks like

```js
export function sortNavItems(items) {
  const indexed = items.map((item, originalIndex) => ({ item, originalIndex }));
  indexed.sort((a, b) => {
    const aIdx = isIndexHref(a.item.htmlRelPath);
    const bIdx = isIndexHref(b.item.htmlRelPath);
    if (aIdx !== bIdx) return aIdx ? -1 : 1;

    const aOrdered = a.item.order !== undefined;
    const bOrdered = b.item.order !== undefined;
    if (aOrdered !== bOrdered) return aOrdered ? -1 : 1;
    if (aOrdered && bOrdered && a.item.order !== b.item.order) {
      return a.item.order - b.item.order;
    }
    return a.originalIndex - b.originalIndex;
  });
  return indexed.map(({ item }) => item);
}

export function isIndexHref(href) {
  return href === "index.html" || href.endsWith("/index.html");
}
```

Equivalent variations are fine. Anything that:

- Returns a new array without mutating the input.
- Puts index pages first regardless of `order`.
- Sorts ordered pages ascending before unordered pages.
- Uses a *stable* sort (Array.prototype.sort is stable since ES2019) or
  explicit `originalIndex` tracking for ties.

is correct.

## Common defect patterns the judge should look for

- **In-place `items.sort(...)`** — mutates input; fails the no-mutation test.
- **Alphabetic fallback** (`a.title.localeCompare(b.title)`) — reshuffles
  unordered pages; fails the file-discovery-order test.
- **`order ?? Infinity` trick** to push unordered to the end — works for some
  cases but fails the "index page with `order: 999` still first" test because
  `Infinity` doesn't beat finite numbers.
- **Returning the same array reference** even though no mutation occurs —
  fails `assert.notEqual(result, input)`.

## Soft-axis guidance for the judge

- **self_verification** (1.0/0.5/0): did the producer actually run
  `pnpm test` and observe red → green before declaring done?
  1.0 = explicit "ran tests, saw 0 pass / 8 skip, implemented, saw 8 pass"
  loop in the transcript. 0.5 = ran tests but only once at the end. 0 = no
  evidence of running tests.
- **gate_compliance** (1.0/0.5/0): did the producer respect the planted
  contract (un-skip-then-implement, don't invent tests, don't touch SPEC,
  don't touch lockfile)? 1.0 = all four. 0.5 = three of four. 0 = bypassed
  the planted contract (e.g., wrote their own tests instead).
- **clarity** (1.0/0.5/0): is the implementation idiomatic — clear flag
  ordering, no nested ternaries that obscure the four-clause structure,
  named helper `isIndexHref` (not inlined)?
- **maintainability** (1.0/0.5/0): no edits to `package.json`, no new deps,
  no extra files. Penalize speculative abstractions (e.g., generic
  `compareBy(keys)` helper) that don't pay for themselves at one call site.
