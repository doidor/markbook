---
"@doidor/markbook-core": minor
---

**Faster navigation (hover prefetch) + opt-in SPA-style View Transitions** (ADR-0032).

Two progressive-enhancement layers for multi-page navigation, with no client-side router:

- **Hover prefetch (on by default).** A `<script type="speculationrules">` block
  (`eagerness: "moderate"`) prefetches same-origin pages on hover/pointerdown, so
  the next page is already cached when clicked. Injected via `{{ head }}`, so
  custom HTML layouts get it too.
- **Cross-document View Transitions (opt-in).** Set `viewTransitions: true` to
  emit `@view-transition { navigation: auto; }` and cut the page over instantly
  (`::view-transition-old/new(root) { animation: none }`) rather than
  cross-fading — fading two different pages superimposes their text into a muddy
  double-exposure that itself reads as a flash. The browser holds the old frame
  until the new page has painted, then swaps with no blank/white repaint, so the
  chrome appears to stay put while the content changes. **Off by default**, and
  never emitted when `disableBaseCss` is set (custom-chrome sites add
  `@view-transition` to their own `css`).

New config field: `viewTransitions?: boolean` (default `false`). Both layers
degrade to plain navigation where unsupported (Firefox cross-document VT today;
Speculation Rules are Chromium-only and a no-op on `file:` pages).
