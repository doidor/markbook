---
title: CLI reference
description: Every Skyline command and its flags.
---

# CLI reference

The `skyline` binary is your only entry point. Every command takes an
optional `--config <path>` flag pointing at a Skyline config file
(default: `./skyline.config.ts`).

## `skyline init [dir]`

Scaffold a new Skyline project.

```bash
skyline init my-app
skyline init . --template minimal
```

| Flag | Default | Description |
| --- | --- | --- |
| `--template <name>` | `full` | Which template to scaffold from |
| `--no-install` | off | Skip the post-scaffold `npm install` |

## `skyline dev`

Run the dev server with hot reload.

```bash
skyline dev
skyline dev --port 5000 --host 0.0.0.0
```

| Flag | Default | Description |
| --- | --- | --- |
| `--port <port>` | `4000` | Port to bind |
| `--host <host>` | `localhost` | Host to bind |
| `--watch <glob>` | `src/**/*` | Files that trigger reload |

## `skyline build`

Bundle the production output.

```bash
skyline build
skyline build --target node18
```

| Flag | Default | Description |
| --- | --- | --- |
| `--target <runtime>` | `node20` | Build target |
| `--minify` | on | Disable with `--no-minify` |

## `skyline deploy`

Deploy to a configured environment.

```bash
skyline deploy --env production
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Build or runtime failure |
| `2` | Configuration error |
| `64` | Bad invocation (missing flag) |
