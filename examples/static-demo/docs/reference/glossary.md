---
title: Glossary
description: Vocabulary used across the Skyline documentation.
---

# Glossary

## Context

The immutable data object passed through a request's handler chain. Carries
parsed parameters, query string, body, session, and environment bindings.

## Handler

A pure function that takes a context and returns a response value. Handlers
compose via `pipe()`.

## Pipeline

An ordered list of handlers that run sequentially. The output context of
one feeds the next.

## Session

Per-user state attached by the authentication middleware. May be `null` for
unauthenticated requests.

## Environment binding

A typed value Skyline injects into the context — a database connection, a
secret, a remote service URL. Declared in `skyline.config.ts`.

## Middleware

A handler that runs before / after the main pipeline. Common middlewares:
auth, logging, CORS, rate limiting.

## Route

A URL pattern bound to a handler or pipeline. Defined declaratively in the
project's `src/routes.ts`.

## Serializer

The function that turns a handler's return value into an HTTP response.
The default JSON serializer is fine for most cases.
