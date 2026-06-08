---
title: Custom directives
description: Extend Markbook with your own :::name directives — youtube embeds, callouts, mermaid diagrams, anything.
---

# Custom directives

Markbook's `:::story`, `:::stories`, and `:::props` directives are useful, but they're only the start. You can register your own `:::name` (or `::name`) directives from `markbook.config.ts` and have them produce any HTML you want.

:::callout{type=info}
**Built on [`remark-directive`](https://github.com/remarkjs/remark-directive).** Markbook layers a registry + dispatcher on top: name-keyed handler lookup, leaf/container form auto-detection, async-with-Promise.all execution, dev-mode dependency tracking, llms.txt markdown fallback, and clear file:line error wrapping. The directive syntax itself (`:::name{attr=value}\nbody\n:::`) comes from remark-directive — you can use other remark-directive consumers in the same project and Markbook will leave their directive names alone.
:::

This is the same extension point [Markbook's own site uses](/index.html) for the callout boxes in these guides:

:::callout{type=info}
This callout — and every other one in this site's guides — is rendered by a custom `:::callout` directive defined in [`markbook-site/directives/callout.ts`](https://github.com/doidor/markbook/blob/main/examples/markbook-site/directives/callout.ts). The full handler is 5 lines.
:::

## Register a directive

In `markbook.config.ts`:

```ts
import { defineConfig } from '@doidor/markbook-core';

export default defineConfig({
  directives: {
    youtube: ({ attributes }) =>
      `<iframe src="https://youtube.com/embed/${attributes.id}" allowfullscreen></iframe>`,

    callout: ({ attributes, innerHtml }) =>
      `<aside class="callout callout-${attributes.type ?? 'info'}">${innerHtml ?? ''}</aside>`,
  },
});
```

Use them in any markdown page:

```markdown
::youtube{id=dQw4w9WgXcQ}

:::callout{type=warning}
This is **markdown** inside a directive. The handler receives the
inner content already-parsed as HTML.
:::
```

## Handlers in external files

Inline handlers are fine for one-liners. Once you have more than a couple, or once a handler needs its own helper functions / constants / fixtures, extract it into its own file:

```
my-site/
├── markbook.config.ts
└── directives/
    ├── callout.ts
    ├── youtube.ts
    └── csv-table.ts
```

Each file just exports a `DirectiveHandler`:

```ts
// directives/callout.ts
import { escapeAttribute, type DirectiveHandler } from '@doidor/markbook-core';

const VALID_TYPES = new Set(['info', 'tip', 'warning', 'danger']);

export const callout: DirectiveHandler = ({ attributes, innerHtml }) => {
  const raw = attributes.type ?? 'info';
  const type = VALID_TYPES.has(raw) ? raw : 'info';
  return `<aside class="callout callout-${escapeAttribute(type)}" role="note">${innerHtml ?? ''}</aside>`;
};
```

Then import and register:

```ts
// markbook.config.ts
import { defineConfig } from '@doidor/markbook-core';
import { callout } from './directives/callout.js';
import { youtube } from './directives/youtube.js';
import { csvTable } from './directives/csv-table.js';

export default defineConfig({
  directives: { callout, youtube, 'csv-table': csvTable },
});
```

The Markbook CLI loads `markbook.config.ts` through [jiti](https://github.com/unjs/jiti), which transparently handles TypeScript imports through the whole config tree — your directive files don't need a separate build step. Use `.js`-style extensions in import paths even when the source is `.ts` (TypeScript's NodeNext convention).

This file pattern also makes directives **testable** with regular Vitest / Jest — they're just functions:

```ts
// directives/callout.test.ts
import { describe, it, expect } from 'vitest';
import { callout } from './callout.js';

describe('callout', () => {
  it('falls back to info on unknown type', async () => {
    const result = await callout({
      name: 'callout',
      attributes: { type: 'unknown' },
      type: 'container',
      innerHtml: '<p>x</p>',
      innerMarkdown: 'x',
      pageFile: '/x.md',
      root: '/',
      frontmatter: {},
    });
    expect(result).toContain('callout-info');
  });
});
```

The official Markbook site uses this pattern — see [`examples/markbook-site/directives/callout.ts`](https://github.com/doidor/markbook/blob/main/examples/markbook-site/directives/callout.ts).

## Templates in HTML files

Hand-written HTML inside JS template literals gets ugly fast. Markbook ships an `htmlTemplate(source)` helper so the markup can live in a real `.html` file next to the handler:

```
my-site/
└── directives/
    ├── callout.ts
    └── callout.html
```

```html
<!-- directives/callout.html -->
<aside class="callout callout-{{ type }}" role="note">
  {{ content }}
</aside>
```

```ts
// directives/callout.ts
import { escapeAttribute, htmlTemplate, type DirectiveHandler } from '@doidor/markbook-core';

const VALID_TYPES = new Set(['info', 'tip', 'warning', 'danger']);
const render = htmlTemplate(new URL('./callout.html', import.meta.url));

export const callout: DirectiveHandler = ({ attributes, innerHtml }) => {
  const raw = attributes.type ?? 'info';
  const type = VALID_TYPES.has(raw) ? raw : 'info';
  return render({
    type: escapeAttribute(type),
    content: innerHtml ?? '',
  });
};
```

The helper:

- **Reads the file once and caches it.** The first `render()` call loads from disk synchronously; subsequent calls are pure string substitution. Same path → same cached body, even across multiple `htmlTemplate()` instances.
- **`{{ key }}` and `{{ key.dot.path }}` substitution.** Missing keys render as an empty string (no throw — keeps optional placeholders ergonomic).
- **All values insert raw — no auto-escaping.** Call `escapeAttribute` / `escapeHtml` yourself on untrusted strings before passing them in. This matches Markbook's layout-placeholder contract: what you pass is what lands. It's also what you want for `innerHtml`, which IS already HTML.
- **HTML comments are preserved verbatim.** `{{ }}` mentions inside `<!-- ... -->` are left alone, so you can document expected variables in the template itself.
- **`new URL('./file.html', import.meta.url)` is the recommended source form** — it resolves relative to the calling module rather than `process.cwd()`. Absolute string paths also work.

If the file is missing, the helper throws a clear `Markbook: htmlTemplate could not read '<path>'` error at first render.

## Two directive forms

| Form | Syntax | Body? | Typical use |
| --- | --- | --- | --- |
| **Leaf** | `::name{attr=value}` | no | "embed this thing" — videos, badges, files |
| **Container** | `:::name{attr=value}\n...\n:::` | yes | "wrap this content" — callouts, tabs, conditional blocks |

For container directives, the handler receives the inner content TWO ways:

- **`innerHtml`** — children already parsed to HTML through Markbook's pipeline. Use this 90% of the time.
- **`innerMarkdown`** — the original markdown source as a string. Use this for directives that want to do their own parsing (e.g. a Mermaid renderer that needs the raw text).

Function handlers accept both forms by default. Pin to one with the descriptor form:

```ts
directives: {
  youtube: {
    type: 'leaf',     // only allow `::youtube{...}`; throw on `:::youtube\n...\n:::`
    handler: ({ attributes }) => `<iframe ...></iframe>`,
  },
  callout: {
    type: 'container', // only allow `:::callout\n...\n:::`; throw on leaf use
    handler: ({ innerHtml }) => `<aside>${innerHtml}</aside>`,
  },
},
```

## Handler context

Every handler receives a single `ctx` object:

```ts
interface DirectiveContext {
  name: string;                                       // 'callout', 'youtube', etc.
  attributes: Record<string, string | undefined>;     // {key=value} attrs
  type: 'leaf' | 'container';                         // how the directive was written
  innerHtml: string | null;                           // parsed children (container only)
  innerMarkdown: string | null;                       // raw source (container only)
  pageFile: string;                                   // absolute path to the .md file
  root: string;                                       // project root (config.root)
  frontmatter: Record<string, unknown>;               // page's frontmatter
}
```

## Handler return values

Three shapes, depending on how much control you want:

```ts
// Shorthand: just HTML
({ attributes }) => `<x>${attributes.foo}</x>`

// Object form: HTML + optional llms.txt markdown fallback + dependencies
({ attributes }) => ({
  html: '<x></x>',
  markdown: '(embedded x)',       // shown in /llms/<page>.txt instead of the directive source
  dependencies: ['/data/x.json'], // dev mode re-renders when these files change
})

// null or undefined: drop the directive entirely (no replacement)
() => null
```

## Async + file I/O

Handlers can be async. For handlers that read files, report them as dependencies so `markbook dev` re-renders the page when they change:

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DirectiveHandler } from '@doidor/markbook-core';

export const csvTable: DirectiveHandler = async ({ attributes, pageFile }) => {
  const abs = path.resolve(path.dirname(pageFile), attributes.src ?? '');
  const text = await fs.readFile(abs, 'utf8');
  const rows = text.trim().split('\n').map((line) => line.split(','));
  const head = rows[0]!.map((c) => `<th>${c}</th>`).join('');
  const body = rows.slice(1).map((row) =>
    `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`
  ).join('');
  return {
    html: `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
    dependencies: [abs],
  };
};
```

```markdown
::csv-table{src=./data/users.csv}
```

Now edit `data/users.csv` and `markbook dev` re-renders the page within ~80ms.

## Built-in conflict

Names that collide with `story`, `stories`, or `props` throw at config load. The built-ins have side effects (story tracking, props-table generation) that a user handler can't replicate, and silently overriding them would be surprising.

## Safety: escaping helpers

Markbook re-exports two tiny helpers for safe interpolation:

```ts
import { escapeHtml, escapeAttribute, defineConfig } from '@doidor/markbook-core';

export default defineConfig({
  directives: {
    badge: ({ attributes }) => {
      const label = attributes.label ?? '';
      const variant = attributes.variant ?? 'info';
      return `<span class="badge badge-${escapeAttribute(variant)}">${escapeHtml(label)}</span>`;
    },
  },
});
```

Frontmatter values that flow into your handler are NOT escaped automatically. If a directive interpolates a value into HTML or attributes, escape it.

## Errors get file:line context

If a handler throws, Markbook re-throws with the source position prepended and the original error preserved as the `cause`:

```
Markbook: directive 'callout' in /tmp/site/pages/intro.md:42:1 threw: <original message>
```

## What you can build with this

- **`::youtube{id=...}`** — video embeds
- **`::badge{label=stable variant=success}`** — labelled badges
- **`:::callout{type=warning}`** — admonitions with markdown content (used by this site)
- **`::mermaid{src=./flow.mmd}`** — diagram renderers
- **`::api{spec=openapi.yaml path=/users}`** — API doc cards
- **`::github-file{repo=foo/bar path=src/Button.tsx}`** — embed a file from GitHub
- **`:::tabs`** + **`:::tab{label=...}`** — tabbed content (two cooperating directives)
- **`::collection{tag=blog limit=5}`** — render a list of pages matching a tag

The shared property: each one is a tiny piece of authoring vocabulary your team gets to use without leaving markdown.

## Reference

- [Directives reference →](../reference/directives.html) — the directive vocabulary (built-in + user).
- [Config reference →](../reference/config.html) — full `MarkbookConfig.directives` typing.
- [`remark-directive`](https://github.com/remarkjs/remark-directive) — the underlying syntax parser.


## Two directive forms

| Form | Syntax | Body? | Typical use |
| --- | --- | --- | --- |
| **Leaf** | `::name{attr=value}` | no | "embed this thing" — videos, badges, files |
| **Container** | `:::name{attr=value}\n...\n:::` | yes | "wrap this content" — callouts, tabs, conditional blocks |

For container directives, the handler receives the inner content TWO ways:

- **`innerHtml`** — children already parsed to HTML through Markbook's pipeline. Use this 90% of the time.
- **`innerMarkdown`** — the original markdown source as a string. Use this for directives that want to do their own parsing (e.g. a Mermaid renderer that needs the raw text).

Function handlers accept both forms by default. Pin to one with the descriptor form:

```ts
directives: {
  youtube: {
    type: 'leaf',     // only allow `::youtube{...}`; throw on `:::youtube\n...\n:::`
    handler: ({ attributes }) => `<iframe ...></iframe>`,
  },
  callout: {
    type: 'container', // only allow `:::callout\n...\n:::`; throw on leaf use
    handler: ({ innerHtml }) => `<aside>${innerHtml}</aside>`,
  },
},
```

## Handler context

Every handler receives a single `ctx` object:

```ts
interface DirectiveContext {
  name: string;                                       // 'callout', 'youtube', etc.
  attributes: Record<string, string | undefined>;     // {key=value} attrs
  type: 'leaf' | 'container';                         // how the directive was written
  innerHtml: string | null;                           // parsed children (container only)
  innerMarkdown: string | null;                       // raw source (container only)
  pageFile: string;                                   // absolute path to the .md file
  root: string;                                       // project root (config.root)
  frontmatter: Record<string, unknown>;               // page's frontmatter
}
```

## Handler return values

Three shapes, depending on how much control you want:

```ts
// Shorthand: just HTML
({ attributes }) => `<x>${attributes.foo}</x>`

// Object form: HTML + optional llms.txt markdown fallback + dependencies
({ attributes }) => ({
  html: '<x></x>',
  markdown: '(embedded x)',       // shown in /llms/<page>.txt instead of the directive source
  dependencies: ['/data/x.json'], // dev mode re-renders when these files change
})

// null or undefined: drop the directive entirely (no replacement)
() => null
```

## Async + file I/O

Handlers can be async. For handlers that read files, report them as dependencies so `markbook dev` re-renders the page when they change:

```ts
import fs from 'node:fs/promises';
import path from 'node:path';

export default defineConfig({
  directives: {
    'csv-table': async ({ attributes, pageFile }) => {
      const abs = path.resolve(path.dirname(pageFile), attributes.src ?? '');
      const text = await fs.readFile(abs, 'utf8');
      const rows = text.trim().split('\n').map((line) => line.split(','));
      const head = rows[0]!.map((c) => `<th>${c}</th>`).join('');
      const body = rows.slice(1).map((row) =>
        `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`
      ).join('');
      return {
        html: `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
        dependencies: [abs],
      };
    },
  },
});
```

```markdown
::csv-table{src=./data/users.csv}
```

Now edit `data/users.csv` and `markbook dev` re-renders the page within ~80ms.

## Built-in conflict

Names that collide with `story`, `stories`, or `props` throw at config load. The built-ins have side effects (story tracking, props-table generation) that a user handler can't replicate, and silently overriding them would be surprising.

## Safety: escaping helpers

Markbook re-exports two tiny helpers for safe interpolation:

```ts
import { escapeHtml, escapeAttribute, defineConfig } from '@doidor/markbook-core';

export default defineConfig({
  directives: {
    badge: ({ attributes }) => {
      const label = attributes.label ?? '';
      const variant = attributes.variant ?? 'info';
      return `<span class="badge badge-${escapeAttribute(variant)}">${escapeHtml(label)}</span>`;
    },
  },
});
```

Frontmatter values that flow into your handler are NOT escaped automatically. If a directive interpolates a value into HTML or attributes, escape it.

## Errors get file:line context

If a handler throws, Markbook re-throws with the source position prepended and the original error preserved as the `cause`:

```
Markbook: directive 'callout' in /tmp/site/pages/intro.md:42:1 threw: <original message>
```

## What you can build with this

- **`::youtube{id=...}`** — video embeds
- **`::badge{label=stable variant=success}`** — labelled badges
- **`:::callout{type=warning}`** — admonitions with markdown content (used by this site)
- **`::mermaid{src=./flow.mmd}`** — diagram renderers
- **`::api{spec=openapi.yaml path=/users}`** — API doc cards
- **`::github-file{repo=foo/bar path=src/Button.tsx}`** — embed a file from GitHub
- **`:::tabs`** + **`:::tab{label=...}`** — tabbed content (two cooperating directives)
- **`::collection{tag=blog limit=5}`** — render a list of pages matching a tag

The shared property: each one is a tiny piece of authoring vocabulary your team gets to use without leaving markdown.

## Reference

- [Directives reference →](../reference/directives.html) — the directive vocabulary (built-in + user).
- [Config reference →](../reference/config.html) — full `MarkbookConfig.directives` typing.
