---
name: markbook-style
description: Apply a pre-baked visual preset (minimal / vibrant / corporate / github / nord) to a Markbook site. Writes a CSS file of --mb-* token overrides and wires it into markbook.config.ts.
trigger: When the user wants to restyle Markbook, apply a theme, or change the look — without writing custom CSS from scratch.
allowed-tools: Bash Read Grep Glob Edit Create
argument-hint: [preset] [--accent <hex>] [--font <family>] [--dest <path>]
---

# markbook-style

Apply a named visual preset to a Markbook site. Each preset is a
self-contained CSS file that overrides Markbook's `--mb-*` design tokens
for both light and dark modes; no `disableBaseCss` opt-out, no
`transformHtml` rewriting — Layer 1 of the
three-layer customization model (see Markbook's `DECISIONS.md` for the full
escalation ladder).

## Available presets

Shipped under this skill's `presets/` directory. Open any one — they're
30-line CSS files showing exactly which tokens get overridden.

| Preset | Feel | Accent | Notes |
| --- | --- | --- | --- |
| `minimal` | Quiet, low-contrast, narrow | `#444` | Achromatic, serif. Best for prose-heavy docs. |
| `vibrant` | Bold, generous spacing, modern | `#7c3aed` | Strong purple. Bigger headings. |
| `corporate` | Traditional, dense | `#1e40af` | Muted blue/gray. Conservative type. |
| `github` | Mimics GitHub Docs | `#0969da` | System font stack, blue accent. |
| `nord` | Cool, calm, designer-y | `#5e81ac` | Full Nord palette. |

## Inputs

- **`preset`** (required, positional) — one of the names above.
- **`--accent <hex>`** (optional) — override the accent color on top of the preset (e.g. `vibrant --accent '#ff6b6b'`).
- **`--font <family>`** (optional) — override the sans-serif font family. Wrap multi-word names in quotes: `--font '"JetBrains Sans", system-ui'`.
- **`--dest <path>`** (optional) — output path relative to the project root. Defaults to `./markbook.css`.

## Steps

1. **Locate the project root.** `view markbook.config.ts` from the cwd; fail with a clear message if not found (suggest running `markbook-init` first).
2. **Validate the preset name** against the table above. Print the available preset list on invalid input.
3. **Read the preset file** from this skill's `presets/<preset>.css`.
4. **Apply overrides if requested.**
   - If `--accent` was supplied, replace the `--mb-accent:` value in BOTH `:root` and `:root[data-theme="dark"]` blocks with the supplied hex. Also update `--mb-link:` to match (the two are usually paired).
   - If `--font` was supplied, replace the `--mb-font-sans:` value the same way.
5. **Write the (possibly mutated) preset CSS** to `<dest>`. Default: `./markbook.css`. If the destination file already exists:
   - If it starts with `/* markbook style preset: ... */` (a previous run's output), overwrite without prompting.
   - Otherwise prompt before overwriting.
6. **Wire it into `markbook.config.ts`.** If the file already has a `css:` field:
   - If `<dest>` is already in the array, do nothing.
   - Otherwise append the path to the array.

   If the config has no `css:` field, insert one inside the `defineConfig({ ... })` block: `css: ['./markbook.css'],`.
7. **Run `markbook build`** (or suggest it) to verify the change rendered.

## Customizing further

Open the generated `markbook.css` and edit any `--mb-*` token. The token
reference is in `node_modules/@markbook/core/README.md` or
https://github.com/doidor/markbook/blob/main/packages/core/README.md.
Common tweaks:

```css
:root {
  --mb-content-width: 880px;      /* wider main column */
  --mb-sidebar-width: 280px;      /* wider left nav */
  --mb-radius: 12px;              /* rounder cards */
  --mb-font-mono: 'Fira Code', ui-monospace;
}
```

## Adding your own preset

This skill's `presets/` directory is installed as a copy in your project's
vendor surface. To add a new preset:

1. Copy an existing `presets/<name>.css` to `presets/<new-name>.css`.
2. Edit the token values.
3. The marker comment at the top (`/* markbook style preset: <name> */`) is required so re-runs can detect-and-overwrite cleanly.

To contribute the preset back to Markbook, open a PR against
`packages/cli/skills/style/presets/` in the markbook repo.

## Prevention tests

- All overrides target `--mb-*` tokens (no rule selectors beyond `:root` / `:root[data-theme="dark"]`). Anything beyond that escalates to Layer 2 (`disableBaseCss: true`) or Layer 3 (`transformHtml`).
- After applying, `markbook build` succeeds and the rendered HTML contains a `<style data-markbook-user-css>` block containing one of the preset's tokens (e.g. the accent hex).
