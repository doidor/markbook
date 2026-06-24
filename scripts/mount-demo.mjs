#!/usr/bin/env node
/**
 * scripts/mount-demo.mjs
 *
 * Mount the built React component demo (examples/react-demo/dist) into the
 * built docs site at examples/markbook-site/dist/demos/react-demo/, so the
 * site's "live demo" links resolve in the deployed output.
 *
 * Run this *after* both builds. The docs site's `markbook build` empties its
 * own dist (Vite `emptyOutDir: true`), so the demo must be layered in last —
 * the root `pnpm example:site:build:demos` script enforces that order, and the
 * deploy-docs workflow calls the same script so CI and a local build produce
 * identical output (you can verify the deployed layout without pushing).
 *
 * The demo builds with `base: './'` (Markbook always does), so every asset and
 * link path is relative and works correctly under the /demos/react-demo/
 * sub-path.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoSrc = path.join(repoRoot, 'examples/react-demo/dist');
const demoDest = path.join(repoRoot, 'examples/markbook-site/dist/demos/react-demo');

if (!existsSync(demoSrc)) {
  console.error(
    `mount-demo: ${path.relative(repoRoot, demoSrc)} not found — run \`pnpm example:build\` first.`,
  );
  process.exit(1);
}

rmSync(demoDest, { recursive: true, force: true });
mkdirSync(demoDest, { recursive: true });
cpSync(demoSrc, demoDest, { recursive: true });

console.log(`mount-demo: copied react-demo → ${path.relative(repoRoot, demoDest)}/`);
