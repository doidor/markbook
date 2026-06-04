#!/usr/bin/env node
/**
 * Stop hook: warn if this session's uncommitted changes touch a
 * public-API surface file (`packages/<name>/src/{index,config}.ts` —
 * the two strongest signals of an architectural / new-feature change)
 * but no agent-harness doc was updated.
 *
 * Advisory only — exits cleanly even on warnings. The pre-commit gate
 * is lint + typecheck + tests; harness drift is a judgement call.
 *
 * Sibling of `stop-progress-check.mjs`. Same input/output contract.
 */
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

// Signals of an architectural / public-API change.
const isPublicApiFile = (line) => /\bpackages\/[^/]+\/src\/(index|config)\.ts$/.test(line);

// Files that count as "harness updated".
const isHarnessDoc = (line) =>
  /(^|\s)(?:M|A|\?\?)\s+(AGENTS\.md|README\.md|ROADMAP\.md|packages\/[^/]+\/(AGENTS|README)\.md|\.copilot\/wiki\/[^/]+\.md)$/.test(
    line,
  ) || /\b(AGENTS|README|ROADMAP)\.md$/.test(line);

const touchedPublicApi = lines.some(isPublicApiFile);
const touchedHarness = lines.some(isHarnessDoc);

if (touchedPublicApi && !touchedHarness) {
  process.stdout.write(
    JSON.stringify({
      systemMessage:
        'Reminder: a public-API surface file (`packages/*/src/{index,config}.ts`) changed this session, but no harness doc was updated. Per the `harness-on-architectural-change` rule, also update the relevant `AGENTS.md` / package README / `ROADMAP.md` / wiki entry in the same commit. See `.copilot/rules/harness-on-architectural-change.md` for the full checklist.',
    }),
  );
}
