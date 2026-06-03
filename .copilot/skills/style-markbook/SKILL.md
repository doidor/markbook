---
name: style-markbook
description: Apply a pre-baked visual preset to the Markbook docs site (contributor shim — same presets we ship as the user-facing `style` skill).
trigger: When a contributor working in this repo wants to test a style preset against the demo site.
allowed-tools: Bash Read Grep Glob Edit Create
argument-hint: [preset] [--accent <hex>] [--font <family>] [--dest <path>]
---

# style-markbook (contributor)

Thin shim for the canonical user-facing **style** skill at
[`packages/cli/skills/style/SKILL.md`](../../../packages/cli/skills/style/SKILL.md).
The presets ship from there (one source of truth, no drift). Read that SKILL.md
for the full procedure — it's the same one consumers run via
`/markbook-style`.

## What's different for contributors

- The canonical presets live at
  [`packages/cli/skills/style/presets/<name>.css`](../../../packages/cli/skills/style/presets/).
- When applying to **this repo's demo** (`examples/react-demo`), write to
  `examples/react-demo/markbook.css` (or `--dest`) and rebuild via
  `pnpm example:build`.
- When you change a preset's CSS, run the verify cycle on the React demo to
  confirm the change renders sensibly.

## When NOT to use this

If you're a Markbook **consumer** (using it for your own component library),
install the user-facing skills via `markbook skills install` and use
`/markbook-style` instead. This shim exists only because contributors need
a way to dogfood the same presets without installing them as if they were
external consumers.
