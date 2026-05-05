#!/usr/bin/env node
import process from 'node:process';

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

const filePath = input?.tool_input?.file_path ?? '';
if (!filePath.includes('/packages/')) {
  process.exit(0);
}

const reminder =
  'You edited code under `packages/`. If this change affects user-facing behaviour, public APIs, or architecture, append an entry to `PROGRESS.md` (use the `/markbook-log` slash command) and update any affected docs in the same change.';

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: reminder,
    },
  }),
);
