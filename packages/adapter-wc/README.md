# `@markbook/adapter-wc`

Web-components mount adapter for [Markbook](../../README.md). Vanilla
custom elements; no framework runtime.

## Install

```bash
npm install -D @markbook/adapter-wc
pnpm add -D @markbook/adapter-wc
yarn add -D @markbook/adapter-wc
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

## Interactive controls

`hasControls: true`. When the default export is a **function**, Markbook calls
it with the current `args` record — `(args) => HTMLElement | string` — so a
story can build markup from the live values. Export an `args` record and
Markbook renders an editable control panel below the preview; each edit
re-invokes the story function and re-mounts. Add an optional `argTypes` map to
pick the input kind (`text` / `number` / `boolean` / `select` with `options`);
otherwise the kind is inferred from the runtime value.

```ts
import './ClickCounter.js';

export const args = { label: 'Clicks', accent: '#ff8c42' };
export const argTypes = { accent: { control: 'select', options: ['#ff8c42', '#42b883'] } };

export default (a) => {
  const el = document.createElement('click-counter');
  el.setAttribute('label', a.label);
  el.setAttribute('accent', a.accent);
  return el;
};
```

## Caveats vs. React

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
