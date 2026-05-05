---
title: Click counter
description: A custom element that counts button clicks.
---

# Click counter

A `<click-counter>` custom element implemented in plain TypeScript. Each story imports the file once for the side-effect registration, then returns the element's tag in an HTML string; `@markbook/adapter-wc`'s `mount` sets that string as the placeholder's `innerHTML` and the browser upgrades the element automatically.

## Default

:::story{src=./Counter/Default.stories.ts}
:::

## A row of three

:::story{src=./Counter/Multiple.stories.ts}
:::
