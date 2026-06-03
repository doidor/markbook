# HTML layout authoring — gotchas

**Symptom collection (any of these):**

1. "My layout works fine but theme toggle / Pagefind / story mounts are broken."
2. "Editing a layout file in `layouts/` doesn't trigger a dev-server reload."
3. "Build fails with `HTML layout 'X' has 2 {{ content }} placeholders` — but I only wrote one!"
4. "Build fails with `HTML layout 'foo' uses unknown placeholder {{ tilte }}`."
5. "Search input doesn't appear in my marketing layout."
6. "My frontmatter `layout: landing` silently rendered the built-in shell — typo'd `landing` as `landng`?"

**Root cause(s):**

| # | Why |
| - | --- |
| 1 | Layout omits `{{ head }}` (theme boot lives there) or `{{ bodyEnd }}` (Pagefind init + story entry script live there). Both are required for any layout that wants those features. |
| 2 | Layout file isn't under one of the configured `layoutsDir` paths — `createContext` resolves `layoutsDir` to absolute paths and `chokidar` watches those paths exactly. Drop the file in the right dir, not just somewhere convenient. |
| 3 | A `{{ content }}` mention appears inside HTML comments (`<!-- ... -->`) AND in the body. Pre-`f598173` the protect-and-restore for comments didn't exist; now it does. Update `@markbook/core`. |
| 4 | Typo'd placeholder name. The strict validator throws on unknown placeholders specifically to catch this. Check the spelling against `HTML_LAYOUT_RAW_TOKENS` + `HTML_LAYOUT_TEXT_TOKENS`. |
| 5 | Layout omits `{{ search }}` — the Pagefind input slot is opt-in per-layout. Drop `{{ search }}` somewhere visible in the layout (typically the header). |
| 6 | NOT a typo silently swallowed: as of `f598173` Markbook throws `HTML layout 'landng' not found in: <searched dirs>`. If you see the built-in shell instead of your layout, your config didn't set `layout:` (or the page's frontmatter set `layout: false`). |

**The unbreakable rules:**

- **Every layout MUST contain exactly one `{{ content }}`** — zero throws, two throws. Duplicate content slots would clone heading IDs and story mount nodes, breaking the page.
- **Wrap `{{ content }}` in `<article data-pagefind-body>` if you want search indexing.** The built-in shell does this automatically; layouts own the wrapping themselves.
- **Keep `{{ head }}` and `{{ bodyEnd }}` in their natural homes** (just before `</head>` and just before `</body>`). Theme boot, Pagefind UI, story entry, copy-code buttons, permalink handler, and keyboard search shortcut all rely on it.
- **Don't write `<title>{{ browserTitle }}</title>` AND include `{{ head }}` and expect Markbook to inject a title.** `{{ head }}` deliberately does NOT include a `<title>` tag — that's the layout author's decision. Use `{{ browserTitle }}` as the string.
- **Frontmatter and text tokens are HTML-escaped.** `{{ title }}`, `{{ description }}`, `{{ siteTitle }}`, `{{ browserTitle }}`, and any `{{ frontmatter.x }}` go through `escapeHtml` before substitution. Safe in element text AND attributes. Raw HTML tokens (`{{ content }}`, `{{ head }}`, `{{ bodyEnd }}`, `{{ pageActions }}`, `{{ search }}`, `{{ themeToggle }}`) pass through verbatim.
- **HTML comments are preserved verbatim.** Placeholders inside `<!-- ... -->` are NOT substituted — useful for documenting the layout's vocabulary in comments without tripping the duplicate-`{{ content }}` check.

**Fix patterns:**

```html
<!-- ✅ A minimal-but-correct layout -->
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ browserTitle }}</title>
  <meta name="description" content="{{ description }}">
  {{ head }}
</head>
<body>
  <header><a href="/">Brand</a> {{ search }} {{ themeToggle }}</header>
  <main>
    {{ pageActions }}
    <article data-pagefind-body>
      {{ content }}
    </article>
  </main>
  {{ bodyEnd }}
</body>
</html>
```

**Tests covering this behaviour:**

- `packages/core/src/template.test.ts` — `applyHtmlLayout` unit tests for every placeholder + validation rule (13 tests).
- `packages/core/src/build-integration.test.ts` — end-to-end dispatch (per-page layout, default layout, `layout: false`, missing layout, missing `{{ content }}`, frontmatter XSS escape, HTML comment preservation).

**Reference:** ADR-0024 in `DECISIONS.md`.
