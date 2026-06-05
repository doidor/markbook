---
title: Getting started
description: Install Skyline, scaffold a project, run the dev server.
---

# Getting started

Skyline is a fictional product. None of the commands below actually work —
this page exists to show what real Markbook documentation looks like.

## Install

```bash
npm install skyline
pnpm add skyline
yarn add skyline
```

## Scaffold a project

```bash
npx skyline init my-app   # pnpm: pnpm skyline init my-app · yarn: yarn skyline init my-app
cd my-app
npm install               # or: pnpm install · yarn install
```

The generator creates a minimal layout:

```
my-app/
├── skyline.config.ts
├── src/
│   ├── main.ts
│   └── handlers/
└── package.json
```

## Run the dev server

```bash
npm run dev   # or: pnpm dev · yarn dev
```

Skyline listens on port `4000` by default; navigate to <http://localhost:4000>.

## Next steps

- Read the [concepts page](./concepts.html) to understand the mental model.
- Browse the [CLI reference](../reference/cli.html) for every command.

> **Tip:** Use the **Copy as Markdown** button at the top of any page to paste
> this content into ChatGPT / Claude as context. It's the page's plain-text
> mirror, generated automatically.
