# `@markbook/adapter-vue`

Vue 3 mount adapter for [Markbook](../../README.md).

## Install

```bash
npm install -D @markbook/adapter-vue vue
pnpm add -D @markbook/adapter-vue vue
yarn add -D @markbook/adapter-vue vue
```

`vue` is a peer dependency (stays external in `--mode package` bundles).

## Configure

```ts
// markbook.config.ts
import { defineConfig } from '@markbook/core';
import { vueAdapter } from '@markbook/adapter-vue/config';

export default defineConfig({
  adapter: vueAdapter(),
});
```

The adapter installs `@vitejs/plugin-vue` automatically — Single-File
Components (`.vue`) and `defineComponent` stories both work.

## Stories

The default export is either a Vue component (most common) or a function
returning JSX:

```ts
import { defineComponent } from 'vue';

export default defineComponent({
  props: { initial: { type: Number, default: 0 } },
  template: `<button @click="count++">Count: {{ count }}</button>`,
  data: () => ({ count: 0 }),
});
```

`:::stories` fan-out is supported: each named export is either a Vue
component or a CSF v3 object `{ render, args?, argTypes?, parameters?, name? }`.
The CSF detector requires at least one metadata field so plain
`defineComponent({ render })` exports are NOT misclassified as CSF.

## Interactive controls

`hasControls: true`. Export an `args` record from a story and Markbook renders
an editable control panel below the preview; each edit re-mounts the component
with the new props (Vue passes `args` to the root component via
`createApp(Comp, args)`). Add an optional `argTypes` map to pick the input kind
(`text` / `number` / `boolean` / `select` with `options`); otherwise the kind is
inferred from the runtime value. `setupControls` is re-exported for advanced use.

## Caveats vs. React

- **Decorators** are supported but configured slightly differently from
  React. Each decorator module's default export should be a Vue component
  with a default slot:

  ```vue
  <!-- preview.vue -->
  <template><div class="preview"><slot /></div></template>
  ```

  `[A, B]` produces `<A><B><Story /></B></A>` outer-to-inner.

## Shadow isolation

`markbook bundle --isolation=shadow` mounts the app inside a child div in an
open shadow root. Vue's reactivity works normally.

## Direct API (advanced)

```ts
import { mount } from '@markbook/adapter-vue';

mount(el, Component, {
  args?: Record<string, unknown>;       // forwarded as createApp(Comp, args)
  parameters?: { layout?: ...; background?: ... };
  isolation?: 'shadow';
});
```
