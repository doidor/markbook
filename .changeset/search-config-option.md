---
"@doidor/markbook-core": minor
---

**Add a `search` config option to disable Pagefind indexing** (ADR-0031).

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
