# `@doidor/markbook-adapter-react` — AGENTS.md

React mount adapter. See [`/AGENTS.md`](../../AGENTS.md) for repo-wide rules and [`README.md`](README.md) for the public API.

## Package-specific rules

1. **Two-entry split (ADR-0005) is non-negotiable.** Browser-side runtime (`mount`, `setupControls`) lives at the default entry (`@doidor/markbook-adapter-react`). The Node-side `reactAdapter()` config helper lives at `@doidor/markbook-adapter-react/config`. Mixing them leaks `@vitejs/plugin-react` and Babel into browser bundles.
2. **`react` + `react-dom` are peer deps.** Never declare them as direct dependencies. They stay external in `--mode package` bundles so consumers reuse their own React.
3. **Decorator composition is outer-to-inner.** `decorators: [A, B]` produces `<A><B><Story/></B></A>`. Match the user's mental reading order; don't flip it.
4. **Controls panel inputs are progressive.** Fall back to a text input when no `argTypes` is declared. Never crash on an unknown control kind — log a warning and use text.

## Common skills

- [`/verify-build`](../../.copilot/skills/verify-build/SKILL.md)
- [`/bundle-story`](../../.copilot/skills/bundle-story/SKILL.md) — produce + smoke-test an embed bundle
