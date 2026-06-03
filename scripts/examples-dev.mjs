#!/usr/bin/env node
/**
 * scripts/examples-dev.mjs
 *
 * Run every example workspace's `markbook dev` server in parallel, each on
 * its own port, with color-coded prefixes. Ctrl-C terminates them all.
 *
 * Used by the root `pnpm examples:dev` script.
 *
 * Add a new example by appending to EXAMPLES below — pick the next free
 * port. Per-example `pnpm example:<x>:dev` scripts still work standalone
 * (they use markbook's default port 5173); only this orchestrator overrides
 * ports so the five servers don't collide.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import concurrently from 'concurrently';

const EXAMPLES = [
  { name: 'react', pkg: '@markbook/example-react-demo', port: 5173, color: 'cyan' },
  { name: 'vue', pkg: '@markbook/example-vue-demo', port: 5174, color: 'green' },
  { name: 'wc', pkg: '@markbook/example-wc-demo', port: 5175, color: 'magenta' },
  { name: 'static', pkg: '@markbook/example-static-demo', port: 5176, color: 'yellow' },
  { name: 'marketing', pkg: '@markbook/example-marketing-demo', port: 5177, color: 'red' },
];

// Pretty header so users immediately know where each server lives.
const namePad = Math.max(...EXAMPLES.map((e) => e.name.length));
console.log('');
console.log('  Markbook examples — dev servers starting…');
console.log('');
for (const e of EXAMPLES) {
  console.log(`    ${e.name.padEnd(namePad)}  →  http://localhost:${e.port}/`);
}
console.log('');
console.log('  Each server hot-reloads independently. Ctrl-C to stop all.');
console.log('');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { result } = concurrently(
  EXAMPLES.map((e) => ({
    name: e.name,
    prefixColor: e.color,
    // Run from the repo root so pnpm's filter resolves against the workspace.
    cwd: repoRoot,
    command: `pnpm --filter ${e.pkg} exec markbook dev --port ${e.port}`,
  })),
  {
    prefix: 'name',
    killOthersOn: ['failure', 'success'],
    restartTries: 0,
    handleInput: false,
  },
);

result.then(
  () => process.exit(0),
  () => process.exit(1),
);
