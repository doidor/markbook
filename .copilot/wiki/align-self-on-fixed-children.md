# `align-self: start` on a desktop sidebar rule silently breaks `position: fixed; top/bottom` on mobile

**Symptom:** A `.markbook-sidebar` rule cascades from a desktop block:

```css
.markbook-sidebar {
  position: sticky;
  align-self: start;       /* <-- this */
  max-height: calc(100vh - var(--mb-header-height) - 3rem);
  overflow-y: auto;
}
```

…into a mobile media-query block:

```css
@media (max-width: 700px) {
  .markbook-sidebar {
    position: fixed;
    top: var(--mb-header-height);
    right: 0;
    bottom: 0;             /* <-- expected to fill viewport bottom */
    left: 0;
    max-height: none;
  }
}
```

Expected: sidebar fills from `top: header-height` to viewport bottom (e.g. 788px on a 844px-tall viewport with a 56px header).

Actual: sidebar is sized to its **intrinsic content height** (e.g. ~340px on a 6-item nav list), regardless of `bottom: 0`. The lower portion of the viewport shows the page underneath, producing a visually broken half-and-half layout.

**Root cause:** `align-self: start` on a grid/flex child *still applies* when the same element gets `position: fixed`. The fixed element's containing block is the viewport, but `align-self` overrides the inset-based sizing — the element falls back to `height: auto` (intrinsic content height). This is per-spec behaviour ("If the alignment subject is an absolutely-positioned box, the alignment property values apply as described for absolutely-positioned boxes…") but easy to miss because the cascade looks innocent.

**Fix:** Explicitly reset `align-self` in the mobile media-query rule:

```css
@media (max-width: 700px) {
  .markbook-sidebar {
    position: fixed;
    align-self: stretch;   /* <-- THIS is the fix */
    top: var(--mb-header-height);
    right: 0;
    bottom: 0;
    left: 0;
    max-height: none;
  }
}
```

`align-self: stretch` tells the browser to honour the inset-based height. `align-self: unset` or `align-self: auto` also works (resets to parent's `align-items` default, usually `stretch`).

**Prevention:**

- When converting a sticky/flow-positioned sidebar to `position: fixed` inside a media query, explicitly override `align-self` even if you think it shouldn't apply.
- Diagnose by setting `background: magenta; outline: 3px solid lime` on the element + measuring `getBoundingClientRect()` — if `rect.height < (viewport - top)`, suspect a cascading `align-self`.
- The bug is invisible to typecheck/lint/tests — only visual inspection catches it. Add a `@media` screenshot to your visual smoke checks when changing sidebar CSS.

**First observed:** 2026-06-09, after the initial mobile-nav patch in ADR-0030 shipped a slide-out drawer. User flagged the visual; the box-debug screenshot (magenta sidebar with lime outline) made the height-collapse obvious.
