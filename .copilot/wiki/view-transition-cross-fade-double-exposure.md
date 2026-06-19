# Cross-document View Transitions: a cross-fade of two different pages reads as a "flash"

**Symptom:** After enabling cross-document View Transitions for SPA-like
navigation (`@view-transition { navigation: auto; }` in `BASE_CSS`), the user
reported there was *still* a flash on every page change, and guessed it was
"the layout CSS." Verified with a headless-Chrome CDP screencast against the
built site that the transition **was** firing (`pageswap` / `pagereveal` events
report `viewTransition=true`) with **no** white/blank frame and the end state
correct — yet the mid-transition frames showed both pages' text superimposed
(e.g. "Agent skills" overlapping "Getting sta**rted**", and the right-hand TOC
showing both pages' headings at once).

**Root cause:** The UA-default View Transition animation is an opacity
**cross-fade**. Cross-fading two *different* documents means that, around the
midpoint, both the outgoing and incoming snapshots sit at ~50% opacity, so their
text superimposes into a muddy "double exposure". Shortening the duration only
makes that muddy window briefer — it never makes it clean, because at the 50%
point any opacity cross-fade is 50/50 regardless of duration. Sequencing the
fades (old out, then new in) doesn't help either: the gap flashes the page
**background** instead.

A second, sneakier trap appeared when switching the content to an instant cut
while keeping a `view-transition-name` on the header + sidebar: with
`animation: none` the *old* named snapshot stays at full opacity under the new
one, and because `.markbook-sidebar` has a **transparent** background, the old
active-highlight bled through the new page's highlight (two items highlighted at
once for a frame). The main content never showed this because the `root`
snapshot includes the **opaque** `<html>` background, which fully covers the old
snapshot.

**Fix:** Don't cross-fade differing content. Cut the page over instantly and let
the whole page ride the opaque `root` snapshot (no named groups):

```css
@view-transition { navigation: auto; }
::view-transition-group(root),
::view-transition-old(root),
::view-transition-new(root) { animation: none; }
```

The browser still holds the old frame until the new page has painted, then swaps
atomically — no blank/white repaint, no double-exposure, no highlight bleed, and
the chrome (identical between pages) appears to stay put. An instant cut also
needs no `prefers-reduced-motion` guard (there is no motion to undo).

**Prevention:**

- For multi-page (cross-document) View Transitions where consecutive pages
  differ a lot (docs sites), prefer an **instant `root` cut** over the default
  cross-fade. A cross-fade only looks good when the two states are mostly the
  same image.
- If you give an element a `view-transition-name` and then use `animation: none`,
  make sure that element's snapshot is **opaque** (has a background), or the old
  snapshot will bleed through. Transparent named elements + instant cut = bleed.
- This class of bug is invisible to typecheck/lint/tests and to a single
  screenshot — you must inspect the *mid-transition* frames. Reproduce with a
  Puppeteer/CDP `Page.startScreencast` while clicking a link; dump frames with
  relative-ms filenames and eyeball the swap window.

**First observed:** 2026-06-18, follow-up to ADR-0032. The first implementation
used the default cross-fade with named persistent chrome; the user still saw a
flash. The CDP screencast (frame at ~114 ms showing "Agent skills" superimposed
on "Getting started") made the double-exposure obvious, and a later frame showed
the sidebar highlight bleed once the content cut was made instant.
