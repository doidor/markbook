# `@markbook/adapter-react`

React mount adapter for [Markbook](../../README.md). Renders any React
component (or function returning JSX) into a story placeholder.

## Install

```bash
npm install -D @markbook/adapter-react react react-dom
pnpm add -D @markbook/adapter-react react react-dom
yarn add -D @markbook/adapter-react react react-dom
```

`react` and `react-dom` are peer dependencies (and stay external in
`--mode package` bundles).

## Configure

```ts
// markbook.config.ts
import { defineConfig } from '@markbook/core';
import { reactAdapter } from '@markbook/adapter-react/config';

export default defineConfig({
  adapter: reactAdapter({
    // Optional decorator stack (outer-to-inner)
    decorators: ['./preview.tsx', './theme.tsx'],
  }),
});
```

The adapter installs `@vitejs/plugin-react` automatically — no Vite config
needed.

## Decorators

A decorator module's default export is a React component receiving
`{ children }`:

```tsx
// preview.tsx
export default function Preview({ children }: { children: React.ReactNode }) {
  return <FluentProvider theme={webLightTheme}>{children}</FluentProvider>;
}
```

`decorators: ['./preview.tsx', './theme.tsx']` produces
`<Preview><Theme><Story /></Theme></Preview>`. The same stack is inlined
into embed and package bundles, so portable stories render identically.

## Controls

This adapter sets `hasControls: true`. Any story whose source exports `args`
gets an interactive control panel under the preview (text / number /
checkbox / select inputs, inferred from arg values or `argTypes`). See the
[core README](../core) for the story-export conventions.

## Shadow isolation

`markbook bundle --isolation=shadow` wraps each mount in
`attachShadow({ mode: 'open' })` and renders into the shadow root, so
host-page CSS doesn't leak in.

## Direct API (advanced)

The default browser entry exports:

```ts
import { mount, setupControls } from '@markbook/adapter-react';

mount(el, StoryComponent, {
  decorators?: React.ComponentType<{ children: React.ReactNode }>[];
  args?: Record<string, unknown>;
  parameters?: { layout?: 'centered' | 'fullscreen' | 'padded'; background?: string };
  isolation?: 'shadow';
});

setupControls(controlsEl, args, argTypes, onChange);
```

These are normally invoked by the entry script Markbook generates — you
only need them if you're hand-rolling embedding.
