# Biome treats `{{ }}` in `.html` files as JSX text expressions

**Symptom:** Pre-commit (or `pnpm lint`) fails on a Markbook directive's HTML template file with:

```
× Text expressions aren't supported.

    5 │ -->
    6 │ <aside class="callout callout-{{ type }}" role="note">
  > 7 │   {{ content }}
      │   ^^^^^^^^^^^^^
    8 │ </aside>
```

…even though the file is valid HTML and the substitution syntax is Markbook's own `htmlTemplate`/`applyHtmlLayout` placeholder vocabulary.

**Root cause:** Biome's HTML linter parses `{{ ... }}` as a JSX/Vue-style text expression and reports it as unsupported. The placeholder syntax is a deliberate Markbook convention (`{{ key }}` / `{{ key.dot.path }}` from `htmlTemplate` and the layout templater), not anything Biome recognises.

**Fix:** Exclude the directory that holds those templates from Biome in `biome.json`. Layout files were already excluded for the same reason; directive templates need the same treatment:

```json
"files": {
  "includes": [
    "**",
    "!**/layouts/**/*.html",
    "!**/directives/**/*.html",   // ← add this row
    ...
  ]
}
```

**Prevention:**

- When adding a new directory convention that holds `.html` files with `{{ }}` placeholders (a new templating surface, a partials directory, anything), add the corresponding `!**/<dir>/**/*.html` exclusion to `biome.json` in the same commit.
- If a user follows the `htmlTemplate` guide and puts `callout.html` somewhere outside `directives/`, point them at this entry or the canonical layout — the convention is **co-locate the `.html` template next to the `.ts` handler under a `directives/` folder**, which the exclusion already covers.
- Don't try to "make Biome happy" by escaping the braces or switching to a different placeholder syntax — Markbook's `htmlTemplate` and `applyHtmlLayout` share the `{{ }}` vocabulary on purpose, and changing it would break user code.
