---
name: markbook-init
description: Scaffold a new Markbook documentation site in the current project — generates markbook.config.ts, a sample docs page + story, and suggests package.json scripts.
trigger: When a Markbook consumer is setting up a docs site for the first time, or asks "how do I get started with Markbook?".
allowed-tools: Bash Read Grep Glob Edit Create
argument-hint: [--framework react|vue|wc]
---

# markbook-init

Generates the minimum viable files for a working Markbook setup in the
current project. Detects the framework from `package.json` dependencies; the
`--framework` flag overrides the detection when ambiguous.

## Pre-checks

1. **Confirm the user wants Markbook in this project.** Run `view package.json`
   and report the project name. Abort if the user says "no" or if no
   `package.json` exists at cwd (suggest creating one first).
2. **Detect framework.** Look in `dependencies` and `devDependencies`:
   - `react` + `react-dom` → React
   - `vue` → Vue 3
   - Neither → web-components (no framework runtime)
   - If `--framework` was supplied, use it.
3. **Refuse to clobber.** If `markbook.config.ts` already exists, abort with
   a clear message — suggest the user remove it first.

## Generated files

### `markbook.config.ts`

For React:
```ts
import { defineConfig } from '@markbook/core';
import { reactAdapter } from '@markbook/adapter-react/config';

export default defineConfig({
  title: '<project name from package.json, title-cased>',
  description: 'Component library documentation.',
  adapter: reactAdapter(),
});
```

Vue: same shape, `vueAdapter()` from `@markbook/adapter-vue/config`.
WC: same shape, `wcAdapter()` from `@markbook/adapter-wc/config`.

### `docs/index.md`

```md
---
title: <project name>
---

# Welcome

This is your Markbook documentation site. Edit `docs/index.md` to change
this page, or add new pages under `docs/`.

See the [Example story](./example/) to see how a story is rendered.
```

### `docs/example/index.md`

```md
---
title: Example
---

# Example

:::story{src=./Example.stories.tsx}
:::
```

### `docs/example/Example.stories.tsx` (React)

```tsx
export default () => (
  <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: 6 }}>
    Hello from your first Markbook story.
  </div>
);
```

(Vue / WC variants follow the same shape — adjust the renderer.)

## Suggested package.json scripts

Do NOT mutate `package.json` directly. Print these exact commands and offer
to run them (with one confirmation per script):

```bash
npm pkg set scripts.docs:build="markbook build"
npm pkg set scripts.docs:dev="markbook dev"
npm pkg set scripts.docs:bundle="markbook bundle"
```

Show the user what each script does, then ask "apply these?" before running.
If any script key already exists, surface the existing value and ask before
overwriting.

## Dependencies

Print and offer to install:

```bash
# React
npm install --save-dev markbook @markbook/core @markbook/adapter-react

# Vue
npm install --save-dev markbook @markbook/core @markbook/adapter-vue

# Web components
npm install --save-dev markbook @markbook/core @markbook/adapter-wc
```

## Next steps prompt

After files land, tell the user:

> Done. Run `npm run docs:dev` to preview, or `markbook skills install --update`
> to refresh the other Markbook skills (`markbook-add-component-page`,
> `markbook-bulk-generate`, `markbook-style`, `markbook-bundle-story`).

## Prevention tests

- `markbook.config.ts` matches the detected framework's adapter (no React imports in a Vue project).
- The generated story file uses the file extension matching the framework (`.tsx` for React, `.vue` or `.ts` for Vue, `.ts` for WC).
- Frontmatter on every generated page has a `title:` and no other fields the user didn't ask for.
- No existing files were overwritten without explicit confirmation.
