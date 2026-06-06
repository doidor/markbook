---
name: core-no-framework
description: Forbid React / Vue / framework-runtime imports inside @markbook/core
glob: packages/core/**/*.{ts,tsx}
priority: 100
---

# core-no-framework

`@markbook/core` is the framework-agnostic engine. **Never** import from a UI
framework runtime in any file under `packages/core/src/`.

## Forbidden imports

```ts
// All forbidden in packages/core/**:
import React from 'react';
import { useState } from 'react';
import * as ReactDOM from 'react-dom';
import { createApp } from 'vue';
import { defineComponent } from '@vue/runtime-core';
// (any web-components helper from lit / fast-element / etc.)
```

## Allowed adjacency

Framework concerns live in the corresponding adapter packages:

| Concern | Belongs in |
| --- | --- |
| `mount(el, story, opts)` for React | `@markbook/adapter-react` |
| `setupControls(...)` for React | `@markbook/adapter-react` |
| Vue / custom-element mount logic | the planned `@markbook/adapter-vue` / `-wc` (not yet built — see `ROADMAP.md` / ADR-0028) |

> Only `@markbook/adapter-react` exists today. The Vue imports above stay on
> the forbidden list regardless — core must never depend on a framework, even
> a future one's runtime.

Core knows about: markdown parsing, directive expansion, Vite orchestration,
embed bundling, template engine, TS-AST extraction. Nothing else.

## If you need new framework behaviour

Add a new field to `MarkbookAdapter` (`packages/core/src/config.ts`) for the
adapter to implement. Core's entry generator (in `build.ts` or `embed.ts`)
calls into the adapter's exported function at runtime, by package name —
never by static import.

## See also

- ADR-0003 — Adapter pattern for framework support
- ADR-0005 — Adapter packages have separate browser and config entry points
