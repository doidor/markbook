---
name: tests-co-located
description: Vitest tests live alongside the source they test; import from sibling modules, not the barrel
glob: packages/**/*.test.ts
priority: 60
---

# tests-co-located

## Conventions

1. **Tests sit next to their source.** `packages/core/src/parse.ts` has its tests in `packages/core/src/parse.test.ts`. No separate `__tests__/` or `test/` directory.
2. **Import from the sibling source module, not the barrel.**
   ```ts
   // ✅
   import { parseMarkdown } from './parse.js';

   // ❌ — would silently couple tests to the public API surface
   import { parseMarkdown } from '@markbook/core';
   ```
   This is what lets `internal.ts` exist without test churn.
3. **Vitest only.** `pnpm --filter @markbook/core test` runs the suite. Tests must run cleanly with no external network, no real-fs writes outside `os.tmpdir()`, and no leaked timers.
4. **Wrap fs writes in `try/finally`.** Always clean up:
   ```ts
   const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-x-'));
   try {
     // ... test ...
   } finally {
     await fs.rm(tmp, { recursive: true, force: true });
   }
   ```
5. **One `describe` per public symbol.** Inside, one `it` per behaviour. Keep test names declarative ("returns null for missing file", not "test1").

## Adding a test

For any change that adds or modifies a function in `parse.ts`, `code.ts`,
`embed.ts`, `template.ts`, `exports.ts`, or `build.ts`, add a matching test
case. Tests are how the API contract survives refactoring.
