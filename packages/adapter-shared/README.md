# `@markbook/adapter-shared`

Browser-side runtime helpers shared by the Markbook framework adapters
([`@markbook/adapter-react`](../adapter-react/README.md),
[`-vue`](../adapter-vue/README.md), [`-wc`](../adapter-wc/README.md)).

This package is **pure DOM** — no Node APIs, no framework runtime imports — so
it bundles cleanly into each adapter's default (browser) entry without dragging
Node-only code across the two-entry split (see
[ADR-0005](../../DECISIONS.md) / [ADR-0026](../../DECISIONS.md)). Every adapter
implements its own `mount()` (and React additionally `setupControls`), but the
placeholder / shadow-root / CSS-injection plumbing is identical, so it lives
here once.

## Exports

| Symbol | Purpose |
| --- | --- |
| `StoryParameters` | `{ layout?, background? }` — per-story display options. |
| `BaseMountOptions` | The framework-agnostic subset of every adapter's `MountOptions` (`isolation`, `parameters`, `css`, `cssId`). Adapters extend it with `args` / decorators. |
| `applyParameters(el, params)` | Swap the `markbook-story--<layout>` class + optional background on the placeholder. |
| `resolveMountTarget(el, isolation)` | Return the placeholder, or a `.markbook-shadow-host` div inside an open shadow root when `isolation: 'shadow'`. |
| `injectCss(target, css, cssId)` | Inject the embed bundle's CSS into the shadow root or `document.head`, deduped by `cssId`. |

This is an internal Markbook implementation package; its surface is consumed by
the official adapters and is not intended as a standalone public API.
