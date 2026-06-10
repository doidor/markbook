# Engine architectural rules

> **These rules are load-bearing.** Reviewers MUST block any change that
> violates them.

## 1. No framework imports inside `src/core/**`

`src/core/` is the **framework-agnostic** engine. Never import from a UI
framework runtime in any file under `src/core/`.

### Forbidden in `src/core/**`

```js
import React from 'react';
import { useState, useEffect, createElement } from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createApp } from 'vue';
import { defineComponent } from '@vue/runtime-core';
import { LitElement } from 'lit';
```

### Where framework imports DO belong

| Framework | Allowed home |
| --- | --- |
| React | `src/adapter-react/**` |
| Vue (when shipped) | `src/adapter-vue/**` |
| Web Components (when shipped) | `src/adapter-wc/**` |

### Why this rule is load-bearing

Adapters exist precisely so the core can be installed without React/Vue/etc.
The moment a single framework import leaks into `src/core/`, the engine
drags that framework into every consumer regardless of which adapter they
actually wanted. The adapter pattern dies silently and tree-shaking can't
save you — the import side-effects pull the whole module graph in.

This rule is more important than naming, formatting, or any style nit
combined. **Block the PR.**

## 2. Adapters are the right home for framework code

`src/adapter-react/` is where React imports live. Adding more React imports
there (e.g. a new hook, a new render utility) is the architecturally-correct
move. **Do not** flag these as violations of rule #1; you'll generate noise
and erode trust.

## 3. Cosmetic refactors are not bugs

Extracting a regex literal into a named constant, renaming a local
variable, or splitting one function into two equivalent ones is not a
bug. Don't block these unless they introduce an actual behaviour change
or a real correctness issue.
