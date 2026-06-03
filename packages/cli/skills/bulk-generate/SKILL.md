---
name: markbook-bulk-generate
description: Generate Markbook docs pages for every component under a directory. Dry-run by default — produces a candidate list for confirmation before writing anything.
trigger: When a user wants to set up Markbook for an existing component library and asks "generate pages for all my components" or similar.
allowed-tools: Bash Read Grep Glob Edit Create
argument-hint: --from <src-dir> [--output <docs-dir>] [--write]
---

# markbook-bulk-generate

The "set up Markbook for my existing component library" workflow. Scans a
directory, identifies component-like files, and generates one docs page plus
a starter stories file per component.

**Dry-run by default.** Never writes anything until the user reviews the
candidate list and supplies `--write`.

## Inputs

- **`--from <src-dir>`** (required) — directory to scan. No default, deliberately — bulk operations should always be explicit about scope.
- **`--output <docs-dir>`** (optional) — where the generated pages land. Defaults to `docs/components/`.
- **`--include <glob>`** / **`--exclude <glob>`** (optional, repeatable) — narrow / widen the scan.
- **`--write`** (optional) — actually write the files. Without this, only the candidate list is printed.

## Steps

1. **Validate `--from`.** Must exist and be a directory. Bail with a clear error otherwise.
2. **Glob component files.** Default include: `**/*.{tsx,vue}` minus `**/*.{test,spec,stories}.*` and `**/index.{ts,tsx,js,jsx}`. Apply user `--include` / `--exclude` patterns.
3. **Filter to "component-like" candidates.** For each file:
   - **React (`.tsx`/`.jsx`)** — has at least one PascalCase export that returns JSX (heuristic: source contains `return <` or `=>` followed by `<`, or the function name starts with uppercase). Skip files whose only exports are types/interfaces/utilities.
   - **Vue (`.vue`)** — file has a `<template>` block.
   - **WC (`.ts`/`.js`)** — file calls `customElements.define(...)`.
   - **TypeScript-only utility files** — skip. (`.ts` without JSX, no custom element registration → skip.)

   Be **conservative**: prefer false negatives over false positives. A missed component is a quick `/markbook-add-component-page` away; a generated page for a utility file is noise the user has to delete.
4. **Build the candidate list.** Table form:
   ```
   Source                                 → Generated docs page
   ──────────────────────────────────────────────────────────────────
   src/components/Button/Button.tsx       → docs/components/Button.md
   src/components/Card/Card.tsx           → docs/components/Card.md
   src/components/Toast/Toast.tsx         → docs/components/Toast.md
                                       (3 components found)
   ```
   Also list **skipped** files with reason ("no JSX returned", "test file", etc.) — the user should understand what's NOT being generated.
5. **Without `--write`:** print the candidate list, print "re-run with --write to generate", stop.
6. **With `--write`:** for each candidate, follow the [`/markbook-add-component-page`](../add-component-page/SKILL.md) steps. Skip any candidate whose target file already exists (don't silently overwrite). Report the count of created vs skipped at the end.
7. **Print summary.**
   ```
   ✓ 3 docs pages created under docs/components/
   ✓ 3 starter stories files created
   - 0 skipped (no name collisions)

   Next:
     - npm run docs:dev    # preview
     - markbook-style       # apply a visual preset
   ```

## Heuristics — known limitations

- **PascalCase-export filter** misses arrow-function components assigned to lowercase vars (`const button = () => ...`). Convention is PascalCase for components; if the user violates that, they need to rename or use `/markbook-add-component-page` per file.
- **No deep prop-type inference.** The generated page uses `:::props` with the React extractor's defaults. Components without TypeScript interfaces produce empty tables.
- **Doesn't follow re-exports.** A barrel `index.ts` is skipped; the underlying file is detected on its own.

## Safety

- Without `--write`, this skill is purely informational — no writes.
- With `--write`, it never overwrites an existing docs page. The user must delete first if they want to regenerate.
- Doesn't touch `markbook.config.ts`. Run [`/markbook-init`](../init/SKILL.md) for that.

## Prevention tests

- Without `--write`, no file is written, anywhere. Verify by running and then `git status` showing zero changes.
- The candidate list shows exactly the files that WOULD be generated, in the table format above.
- The skipped list explains the reason per file.
- With `--write`, every created page has the same shape `/markbook-add-component-page` would produce for that file.

## Related
- [`/markbook-add-component-page`](../add-component-page/SKILL.md) — the unit operation
- [`/markbook-init`](../init/SKILL.md) — scaffold the rest of the Markbook setup
