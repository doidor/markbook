# Releasing

Markbook is published to npm as four packages under the `@doidor` scope, versioned
in **lockstep** (the `fixed` group in [`.changeset/config.json`](.changeset/config.json)):

- [`@doidor/markbook`](packages/cli) (the CLI)
- [`@doidor/markbook-core`](packages/core)
- [`@doidor/markbook-adapter-react`](packages/adapter-react)
- [`@doidor/markbook-adapter-shared`](packages/adapter-shared)

Releases are driven by [**Changesets**](https://github.com/changesets/changesets) +
[`.github/workflows/release.yml`](.github/workflows/release.yml): version bumps and the npm publish
are automatic, **tokenlessly via OIDC** (npm Trusted Publishing). You never edit a version by hand
or push a tag manually.

## One-time setup

1. **Configure a Trusted Publisher on npmjs.com — once per package.** This replaces an
   `NPM_TOKEN` secret with short-lived OIDC credentials. For **each** of the four packages:
   - npmjs.com → **Packages → `<package>` → Settings → Trusted Publisher**.
   - Choose **GitHub Actions** and set: organization/owner `doidor`, repository `markbook`,
     workflow filename **`release.yml`** (leave *Environment* blank). The workflow filename is
     case-sensitive.
   - For maximum security, then set **Publishing access → "Require two-factor authentication and
     disallow tokens"** so only this workflow can publish.
2. **Allow Actions to open PRs:** Settings → Actions → General → Workflow permissions →
   enable *"Allow GitHub Actions to create and approve pull requests"* (the release workflow opens
   the "Version Packages" PR using the built-in `GITHUB_TOKEN`).
3. Public access is already configured (`access: "public"` in `.changeset/config.json`), and
   **provenance is generated automatically** under trusted publishing — no flag or secret needed.

> **First publish of a brand-new package name:** a Trusted Publisher is configured on the
> *package's* settings page, so the package must exist. The four `@doidor/markbook*` packages are
> already published at `0.1.1`, so this isn't a concern — just configure each one's Trusted
> Publisher and you're done.

## Day-to-day: how a release happens

1. **Describe each change with a changeset** (commit it alongside your code change):
   ```bash
   pnpm changeset
   ```
   Pick **patch / minor / major** and write a one-line summary. It creates a file in `.changeset/`.
   Because the four packages are in a `fixed` group, a changeset on any one of them bumps **all four**
   in lockstep — pick whichever package the change actually targets.
2. **Push / merge to `main`.** The **Release** workflow opens (or updates) a **"Version Packages"** PR
   that bumps every published package's `package.json` and writes per-package `CHANGELOG.md` from the
   consumed changesets.
3. **Merge the "Version Packages" PR.** The workflow runs again, sees the bumped versions, and
   **publishes to npm** via `pnpm -r publish` — authenticated **tokenlessly via OIDC**, with
   automatic provenance, and pushes a `vX.Y.Z` git tag.

That's it — no manual `npm version`, `npm publish`, or `gh release create`.

## Pre-releases (optional)

Use Changesets pre-release mode when you want `next`-tagged builds:

```bash
pnpm changeset pre enter next   # then add changesets + push as usual
pnpm changeset pre exit         # when going back to stable
```

## Verify

```bash
npm view @doidor/markbook version
npx @doidor/markbook --version
```

## Notes

- The published CLI binary is `markbook`, so `npx @doidor/markbook <cmd>` and a global install
  (`npm i -g @doidor/markbook` → `markbook <cmd>`) both work.
- `pnpm publish` delegates the upload to the `npm` on `PATH`; trusted publishing needs npm
  ≥ 11.5.1, so the workflow installs the latest npm before running the publish step.
- `workspace:*` cross-refs between packages are rewritten to the concrete version by pnpm at
  publish time, so the four packages' published tarballs depend on the same concrete version.
