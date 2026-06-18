---
"@doidor/markbook-core": minor
---

**Navigation between pages now feels SPA-like** — no more clip/jump on each click (ADR-0032).

Built sites are multi-page apps, so every link is a full document navigation that
repaints the whole DOM (the header + sidebar visibly flashed, even though pages
are well-cached). Two zero-config, progressive-enhancement layers fix that, with
no client-side router and no new config:

- **Cross-document View Transitions.** `BASE_CSS` emits
  `@view-transition { navigation: auto; }` and cuts the page over instantly
  (`::view-transition-old/new(root) { animation: none }`) rather than
  cross-fading — fading two different pages superimposes their text into a muddy
  double-exposure that itself reads as a flash. The browser holds the old frame
  until the new page has painted, then swaps with no blank/white repaint, so the
  chrome appears to stay put while the content changes. No animation also means
  nothing to undo for `prefers-reduced-motion`. Gated off by `disableBaseCss`
  (custom-chrome sites own their transitions).
- **Hover prefetch.** A `<script type="speculationrules">` block
  (`eagerness: "moderate"`) prefetches same-origin pages on hover/pointerdown, so
  the next page is already cached when clicked. Injected via `{{ head }}`, so
  custom HTML layouts get it too.

Both degrade to plain navigation where unsupported (Firefox cross-document VT
today; Speculation Rules are Chromium-only and a no-op on `file:` pages).
