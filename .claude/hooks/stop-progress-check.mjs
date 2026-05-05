#!/usr/bin/env node
import process from 'node:process';
import { execSync } from 'node:child_process';

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

if (input?.stop_hook_active) {
  process.exit(0);
}

const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

let status = '';
try {
  status = execSync('git status --porcelain', { encoding: 'utf8', cwd });
} catch {
  process.exit(0);
}

const lines = status.split('\n').filter(Boolean);
const touchedPackages = lines.some((l) => l.includes('packages/'));
const touchedProgress = lines.some((l) => l.includes('PROGRESS.md'));

if (touchedPackages && !touchedProgress) {
  process.stdout.write(
    JSON.stringify({
      systemMessage:
        'Reminder: files under `packages/` changed this session but `PROGRESS.md` was not updated. Run `/markbook-log` to record an entry before moving on.',
    }),
  );
}
