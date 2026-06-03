# `@markbook/adapter-wc`

Web-components mount adapter for [Markbook](../../README.md). Vanilla
custom elements; no framework runtime.

## Install

```bash
pnpm add -D @markbook/adapter-wc
```

No peer dependencies. The adapter ships no Vite plugin (custom elements are
plain JS — Vite handles them natively).

## Configure

```ts
// markbook.config.ts
import { defineConfig } from '@markbook/core';
import { wcAdapter } from '@markbook/adapter-wc/config';

export default defineConfig({
  adapter: wcAdapter(),
});
```

## Stories

The default export can be any of:

- A string of HTML (`'<click-counter></click-counter>'`)
- A function returning a string (`(args) => '<click-counter step="2"></click-counter>'`)
- A `Node` / `HTMLElement` (or function returning one)

```ts
import './ClickCounter.js';  // side-effect: defines <click-counter>

export default () => '<click-counter step="2"></click-counter>';
```

The element's `connectedCallback` runs when Markbook inserts it into the
placeholder. Re-mounts are cheap — Markbook clears the placeholder via
`innerHTML = ''` before the next render.

## Bundle size

Because there's no framework runtime to inline, embed-mode bundles are tiny
(typically <2 KB minified for a single small custom element). Compare to
~200 KB for an equivalent React bundle.

## Caveats vs. React

- **No interactive controls.** `hasControls: false`. `args` is parsed and
  passed through `MountOptions` but the WC mount does **not** invoke the
  story function with args — write your story to read attributes/properties
  off the element instead.
- **No decorators.** Slots / providers / themes for custom elements are
  composed at the DOM level, which is a different model from React's
  context wrappers.

## Shadow isolation

`markbook bundle --isolation=shadow` writes the story output (string or
node) directly into an open shadow root via `innerHTML` / `appendChild`.
Custom elements with their own internal shadow DOM work fine inside.

## Direct API (advanced)

```ts
import { mount } from '@markbook/adapter-wc';

mount(el, render, {
  args?: Record<string, unknown>;
  parameters?: { layout?: ...; background?: ... };
  isolation?: 'shadow';
});
```
