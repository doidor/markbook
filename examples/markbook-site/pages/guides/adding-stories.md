---
title: Adding component stories
description: Mount React component examples inside your markdown pages.
---

# Adding component stories

This is what makes Markbook a Storybook alternative when you need one — the same engine that renders your docs can also mount live framework components into the page.

## Pick an adapter

Markbook ships one adapter today: `@doidor/markbook-adapter-react` (mounts React components; `react` + `react-dom` as peer deps). Vue and Web Components adapters are on the [roadmap](https://github.com/doidor/markbook/blob/main/ROADMAP.md) — the core engine is framework-agnostic, so they're purely additive.

Install it + its runtime:

```bash
pnpm add -D @doidor/markbook-adapter-react
pnpm add react react-dom
```

Then wire it into `markbook.config.ts`:

```ts
import { defineConfig } from '@doidor/markbook-core';
import { reactAdapter } from '@doidor/markbook-adapter-react/config';

export default defineConfig({
  title: 'My Components',
  adapter: reactAdapter(),
});
```

## Write a story file

A story file is a regular `.tsx` / `.ts` file that lives next to (or under) your markdown. **One story per file** is the convention:

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

- **`args`** — initial prop values. With the React adapter, an interactive controls panel renders under the story so readers can tweak props live.
- **`argTypes`** — control-type hints (`text`, `number`, `boolean`, `select`). Optional; inferred from `args` types when omitted.
- **`parameters.layout`** — `centered` | `padded` | `fullscreen`. Controls how the story is positioned in its placeholder. Honored by the React adapter.

## Decorators (global providers)

Wrap every story in shared providers (theme, i18n, router, ...):

```ts
// markbook.config.ts
import { reactAdapter } from '@doidor/markbook-adapter-react/config';

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

`markbook bundle` packages each story as a portable artifact — `embed` mode produces a self-mounting ESM script you drop on any HTML page; `package` mode produces a publishable npm package directory with the framework as a peer dep. See the [`markbook bundle` CLI reference →](../reference/cli.html#markbook-bundle-storyid) for the full flag set and worked examples.

## Next steps

- [Customization →](./customization.html) — restyle the chrome around your stories.
- [Search & SEO →](./search-and-seo.html) — make sure your component docs are indexable.
- [Config reference →](../reference/config.html) — full adapter + bundle options.
