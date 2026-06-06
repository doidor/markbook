---
title: Adding component stories
description: Mount React, Vue, or web-component examples inside your markdown pages.
---

# Adding component stories

This is what makes Markbook a Storybook alternative when you need one — the same engine that renders your docs can also mount live framework components into the page.

## Pick an adapter

Markbook ships three:

| Package | Mounts | Runtime |
| --- | --- | --- |
| `@markbook/adapter-react` | React components | `react`, `react-dom` (peer) |
| `@markbook/adapter-vue` | Vue 3 components | `vue` (peer) |
| `@markbook/adapter-wc` | Custom elements | (none — vanilla DOM) |

Install one + its runtime (npm / pnpm / yarn):

```bash
npm install -D @markbook/adapter-react && npm install react react-dom
pnpm add -D @markbook/adapter-react && pnpm add react react-dom
yarn add -D @markbook/adapter-react && yarn add react react-dom
```

Then wire it into `markbook.config.ts`:

```ts
import { defineConfig } from '@markbook/core';
import { reactAdapter } from '@markbook/adapter-react/config';

export default defineConfig({
  title: 'My Components',
  adapter: reactAdapter(),
});
```

`reactAdapter()`, `vueAdapter()`, `wcAdapter()` — same shape, same call site.

## Write a story file

A story file is a regular `.tsx` / `.vue` / `.ts` file that lives next to (or under) your markdown. **One story per file** is the convention:

```tsx
// pages/Button/Primary.stories.tsx
import { Button } from '../../../src/Button';

export default () => <Button variant="primary">Click me</Button>;
```

That's it. No `Meta` object, no `decorator` wrapper required. The default export is the story.

## Reference it from markdown

In any `.md` page:

```markdown
## Primary button

:::story{src=./Button/Primary.stories.tsx}
:::
```

Build the site (`markbook build` or `markbook dev`). Markbook:

1. Inserts a placeholder `<div data-markbook-story="...">` where the directive was.
2. Generates an entry script per page that imports each story module, then calls the adapter's `mount()` for each placeholder.
3. Renders a Shiki-highlighted source view under each mounted story (the "Show code" disclosure).

The result: a live, fully-rendered React component inside your markdown, with its source visible for reference.

## Multi-export story files: `:::stories`

When you have several variants of the same component, drop them all into one file as named exports:

```tsx
// pages/Button/Button.stories.tsx
import { Button } from '../../../src/Button';

export const Primary = () => <Button variant="primary">Primary</Button>;
export const Secondary = () => <Button variant="secondary">Secondary</Button>;
export const Disabled = () => <Button disabled>Disabled</Button>;
```

Then use `:::stories` (plural):

```markdown
:::stories{src=./Button/Button.stories.tsx}
:::
```

Markbook discovers every named runtime export via TypeScript AST analysis, renders each as a card with its name (humanized — `Primary` → "Primary", `MyCoolStory` → "My cool story"), and slices the source disclosure per export.

## CSF v3 metadata (`args`, `argTypes`, `parameters`)

If you've used Storybook before, the export shape is familiar:

```tsx
export const Primary = {
  render: (args) => <Button {...args}>Click me</Button>,
  args: { variant: 'primary', disabled: false },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary'] },
    disabled: { control: 'boolean' },
  },
  parameters: { layout: 'centered' },
};
```

- **`args`** — initial prop values. All three adapters (React, Vue, web components) render an interactive controls panel under the story so readers can tweak props live.
- **`argTypes`** — control-type hints (`text`, `number`, `boolean`, `select`). Optional; inferred from `args` types when omitted.
- **`parameters.layout`** — `centered` | `padded` | `fullscreen`. Controls how the story is positioned in its placeholder. Honored by all three adapters.

## Decorators (global providers)

Wrap every story in shared providers (theme, i18n, router, ...):

```ts
// markbook.config.ts
import { reactAdapter } from '@markbook/adapter-react/config';

export default defineConfig({
  adapter: reactAdapter({
    decorators: ['./preview.tsx', './theme.tsx'],
  }),
});
```

```tsx
// preview.tsx — outer wrapper
export default function Preview({ children }) {
  return <div className="story-frame">{children}</div>;
}
```

Decorators apply outer-to-inner: `['A', 'B']` produces `<A><B><Story /></B></A>`.

## Bundling stories for use outside the docs site

`markbook bundle` packages each story as a portable artifact. Two modes:

```bash
# Default — self-mounting ESM embeds.
# Each story becomes dist/embed/<slug>.js that auto-mounts on
# any <div data-markbook-embed="<slug>"> placeholder.
markbook bundle

# Publishable npm package directory, framework as peer dep.
markbook bundle --mode package
```

Use this when you want to drop a story into a marketing landing page, a third-party docs site, or a customer portal — anywhere your component should appear without dragging your docs site along.

## Next steps

- [Customization →](./customization.html) — restyle the chrome around your stories.
- [Search & SEO →](./search-and-seo.html) — make sure your component docs are indexable.
- [Config reference →](../reference/config.html) — full adapter + bundle options.
