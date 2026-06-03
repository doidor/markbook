---
title: Concepts
description: Skyline's mental model — handlers, contexts, and the request/response loop.
---

# Concepts

Skyline organizes work around three primitives. Understanding how they compose
is enough to read the rest of the docs without surprises.

## Handlers

A **handler** is a function that takes a *request context* and produces a
*response*. Handlers are pure by convention — they read from the context,
return data, and never mutate global state.

```ts
import { handler } from 'skyline';

export const greet = handler((ctx) => {
  return { message: `Hello, ${ctx.params.name}!` };
});
```

Handlers compose freely. The output of one can be the input to another via
the `pipe()` helper.

## Contexts

A **context** carries the data flowing through one request lifecycle:

| Field | Type | Description |
| --- | --- | --- |
| `ctx.params` | `Record<string, string>` | Path parameters |
| `ctx.query` | `URLSearchParams` | Query string |
| `ctx.body` | `unknown` | Parsed request body |
| `ctx.session` | `Session \| null` | Current user session |
| `ctx.env` | `Env` | Environment bindings |

Contexts are immutable. To "modify" a context, derive a new one with `ctx.with({...})`.

## The request/response loop

Every Skyline request flows through the same stages:

1. **Parse** — the router resolves the handler chain
2. **Authenticate** — middleware attaches the session if any
3. **Execute** — handlers run in order, each receiving the previous context
4. **Serialize** — the final return value becomes the HTTP response

This is intentionally boring. Boring loops are easy to debug.

## See also

- [Reference / CLI](../reference/cli.html) for the commands that drive this loop
- [Reference / Glossary](../reference/glossary.html) for term definitions
