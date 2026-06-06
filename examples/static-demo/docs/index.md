---
title: Skyline
description: A fictional company documentation site, built with Markbook in markdown-only mode.
---

# Skyline

Welcome to **Skyline** — a fictional product whose only purpose here is to demonstrate
what Markbook looks like when you point it at a directory of plain markdown files,
with no framework components in sight.

Everything you see is rendered from CommonMark:

- The left navigation is built from the directory structure (`guide/`, `reference/`).
- Each page's title in the header and browser tab comes from frontmatter — no
  `title:` is set in `markbook.config.ts`.
- Search (top-right, or press `Cmd-K` / `Ctrl-K`) is indexed by Pagefind.
- Every page has **View as Markdown** and **Copy as Markdown** action buttons
  pointing at its `llms/<path>.txt` mirror — try them.
- Dark mode is in the top-right corner.
- Visual styling is the `nord` preset from the `markbook-style` skill, with
  zero hand-rolled CSS beyond what the preset ships.

## Start reading

| Section | What you'll find |
| --- | --- |
| [Guide / Getting started](./guide/getting-started.html) | Install, scaffold, run |
| [Guide / Concepts](./guide/concepts.html) | The mental model |
| [Reference / CLI](./reference/cli.html) | Every command + flag |
| [Reference / Glossary](./reference/glossary.html) | The vocabulary |

## Why a markdown-only site?

Most Markbook docs sites pair markdown with component-library stories. But the
underlying engine — Vite + remark + Pagefind + `llms.txt` — works just fine on
prose alone. If you want a personal site, a small product landing, or a
documentation site for something that isn't a component library, declare no
adapter and Markbook gets out of your way.
