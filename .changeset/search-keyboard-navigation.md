---
"@doidor/markbook-core": minor
---

**Keyboard navigation for Pagefind search results.**

The built-in search box now supports full keyboard navigation, on top of the
existing `Cmd/Ctrl-K` and `/` focus shortcuts:

- **ArrowDown / ArrowUp** move focus through the result links once the drawer
  is open — `input → first result → … →` wrapping at the ends; `ArrowUp` off
  the first result returns to the search input.
- **Enter** activates the focused result.
- **Escape** returns focus to the input.

Focus moves to the real result `<a>` elements (not a synthetic highlight), so
activation and screen-reader semantics stay native; a `:focus-visible` ring
marks the active result. No configuration — it ships whenever search is
enabled (the Pagefind default UI provides none of this on its own).
