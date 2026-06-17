# @doidor/markbook-core

## 0.4.0

### Minor Changes

- [#24](https://github.com/doidor/markbook/pull/24) [`65a9def`](https://github.com/doidor/markbook/commit/65a9defbaca630bc09d1ba7dbe3b7a1cb9c30130) Thanks [@doidor](https://github.com/doidor)! - **Nested directives now compose inside container bodies** ([#20](https://github.com/doidor/markbook/issues/20)).

  Leaf and container directives written inside a `:::` container are resolved
  through their handlers instead of rendering as empty `<div>` elements:

  ```md
  :::section{label=Currently}
  ::about-item{label="Role:" text="Principal Engineer"}
  ::about-item{label="Team:" text="Core"}
  :::
  ```

  The `section` handler receives each `about-item`'s rendered output as
  `innerHtml`. Containers nest too (add more colons to the outer fence, like
  nested code fences). Nested-handler `dependencies` roll up into the page's
  dev-mode watch set, and a thrown nested handler is wrapped with the same
  `file:line:col` context as a top-level one. Built-in directives
  (`story` / `stories` / `props`) remain top-level only.

  Also fixes a latent bug where `innerMarkdown` returned the page's frontmatter
  text (instead of the container body) when frontmatter was present — offsets
  now index the frontmatter-stripped content.

  Directives are still not parsed inside raw HTML blocks (`<ul>…</ul>`) — that's
  a CommonMark rule; use a container directive (e.g. a `link-list` wrapping
  `link` children) to build the same structure.

## 0.3.0

### Minor Changes

- [#18](https://github.com/doidor/markbook/pull/18) [`d0b2752`](https://github.com/doidor/markbook/commit/d0b27526ccc138aafa3ec335f3db956b1a7c03b4) Thanks [@doidor](https://github.com/doidor)! - **Add a `search` config option to disable Pagefind indexing** (ADR-0031).

  `MarkbookConfig` gains `search?: boolean` (default `true`). Set
  `search: false` to skip Pagefind entirely:

  - `runPagefind()` is never called in `build` **or** `dev`, so the native
    Pagefind binary never loads — this unblocks platforms where it crashes,
    notably **ARM64 Linux with a 16K memory page size** (e.g. Raspberry Pi 5),
    where jemalloc aborts with `Unsupported system page size`.
  - No `pagefind/` directory is emitted.
  - The `{{ search }}` placeholder (and the built-in shell's search box)
    renders empty.
  - `{{ bodyEnd }}` omits the Pagefind UI init script — it still emits the
    story entry module script when an adapter is configured.

  The default stays `true`, so existing sites are unaffected. Useful for
  single-page portfolios, marketing, and landing pages that don't need search.

## 0.2.0

### Minor Changes

- [#12](https://github.com/doidor/markbook/pull/12) [`0851ec8`](https://github.com/doidor/markbook/commit/0851ec8ca59a151ce6585f4256f7b662e259bbdc) Thanks [@doidor](https://github.com/doidor)! - **Agent-first positioning + Starlight-style mobile hamburger nav** (ADR-0030).

  Two v1.0-polish changes bundled:

  1.  **Mobile hamburger nav.** The built-in chrome's mobile breakpoint
      (`@media (max-width: 700px)`) previously hid the sidebar entirely with no
      way to reopen it. Replaced with a Starlight-style full-viewport panel:

           - **`[data-markbook-nav-toggle]`** — hamburger button in `.markbook-header`,
             visible only on mobile via CSS. The matching `aria-controls` points at
             `#markbook-sidebar`.
           - **`body[data-markbook-nav-open]`** — the open-state scope. Sidebar
             slides in from `transform: translateX(-100%)` to `translateX(0)`, body
             scroll locks.
           - **`#markbook-sidebar`** — sidebar carries this id so `aria-controls`
             resolves. On mobile it expands to `inset: var(--mb-header-height) 0 0 0`
             covering the page entirely (so no backdrop is needed; the toggle / ESC
             / nav-link clicks are the dismiss affordances).
           - **`[data-markbook-nav-backdrop]`** — emitted in the DOM but
             `display: none` on mobile; layout authors who want a side-drawer
             pattern can un-hide it from their own stylesheet.
           - **`NAV_TOGGLE_BOOT_SCRIPT`** — eighth boot IIFE: delegated click,
             Escape-to-close (restores focus to the toggle), click-on-sidebar-link
             auto-close, click-on-backdrop dismiss, `aria-expanded` sync.
           - `prefers-reduced-motion` disables the slide; `overscroll-behavior:

      contain` prevents scroll-chaining behind the open menu.

  - Mobile nav rows get bigger padding (`0.6rem 0.85rem`) + 1rem font for
    tap-friendliness.
  - Layout authors (`layoutsDir`) opt in by adding the same data attributes
    to their own markup — the boot script ships via `{{ head }}` for free.

  2.  **Agent-first docs surface.** The six skills shipped via
      `markbook skills install` (`markbook-init`, `markbook-add-component-page`,
      `markbook-bulk-generate`, `markbook-style`, `markbook-layout`,
      `markbook-bundle-story`) are now first-class on the docs site:
      `examples/markbook-site/pages/guides/agent-skills.md` (per-skill
      walkthrough + agent-first rationale) and
      `examples/markbook-site/pages/reference/skills.md` (every flag of every
      skill). Home page leads with an "Agent-first by default" hero spotlight
      - feature card; top-nav gains a "Skills" link. Top-level `README.md`
        promotes agent-first to the first Why bullet and the most prominent
        Install callout.

  The four new DOM hooks (`[data-markbook-nav-toggle]`,
  `[data-markbook-nav-backdrop]`, `body[data-markbook-nav-open]`,
  `#markbook-sidebar`) join the v1.0-stable chrome contract listed in
  `ROADMAP.md`.

## 0.1.2
