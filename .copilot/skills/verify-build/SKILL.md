---
name: verify-build
description: Pre-handoff verification loop — lint, typecheck, test, build, plus the three example demo builds. Iteration cap N=3.
trigger: Before claiming a change is done. Before opening a PR. Before invoking another agent for review.
allowed-tools: Bash Read
argument-hint: [--quick]
---

# verify-build

## Full cycle (default)

Run in order. Stop on first failure, fix, re-run from the start:

```bash
pnpm lint            # biome (use pnpm lint:fix for auto-fixes)
pnpm typecheck       # tsc --noEmit across every package
pnpm test            # @markbook/core Vitest suite
pnpm build           # tsc -b across packages
pnpm example:build           # React demo (most code-path coverage)
pnpm example:bundle          # React demo embed bundles (catches embed-path regressions)
pnpm example:vue:build       # Proves adapter-agnostic core changes don't regress Vue
pnpm example:wc:build        # Proves the zero-runtime WC path
```

Total ~60–120 seconds depending on cache state.

## `--quick` mode

For tight inner loops on a single package:

```bash
pnpm --filter @markbook/<package> typecheck
pnpm --filter @markbook/<package> test   # if applicable
pnpm lint                                 # always — fast
```

Run the full cycle before handoff.

## Iteration cap

If the same step fails 3 times on the same root cause, **STOP**. Self-park:
leave a clear status note about what was tried and what the next investigator
should check. Continuing past this point almost always means the model is
stuck in a wrong mental model.

## Failure → root cause cheatsheet

| Failure | Most-common root cause |
| --- | --- |
| `biome` style errors | Run `pnpm lint:fix` — most are auto-fixable. The 5% that aren't usually mean a real issue. |
| `tsc` `MISSING_EXPORT` | Either a typo in an import OR an `export type { … }` that should be `export { … }`. |
| Vitest `Transform failed` on a `.ts` file | Likely a backtick or `${` collision inside a TS template literal — see `.copilot/wiki/css-in-ts-template-literal.md`. |
| `Vite` build hangs / stale output | `rm -rf .markbook` to clear tmpDir and retry. |
| Example build "pagefind 404 / can't be bundled without type=module" | Cosmetic — Pagefind assets are emitted POST-bundle. The warning is expected; the build still produces a usable dist. |

## Prevention tests

- Never claim done without running the full cycle.
- Never push a commit that the full cycle hasn't passed against.
- Document any newly-discovered failure pattern in `.copilot/wiki/` so the next agent's cycle catches it sooner.
