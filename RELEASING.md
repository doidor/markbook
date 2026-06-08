# Releasing

Markbook is published to npm as four packages under the `@doidor` scope, versioned
in lockstep:

- [`@doidor/markbook`](packages/cli) (the CLI)
- [`@doidor/markbook-core`](packages/core)
- [`@doidor/markbook-adapter-react`](packages/adapter-react)
- [`@doidor/markbook-adapter-shared`](packages/adapter-shared)

Publishing runs in CI via [`.github/workflows/release.yml`](.github/workflows/release.yml)
— there is no manual `npm publish` step.

## One-time setup

1. Create an npm **automation** access token (npmjs.com → *Access Tokens* →
   *Generate New Token* → *Automation*). It must be able to publish to the
   `@doidor` scope.
2. Add it to the repo as a secret named **`NPM_TOKEN`**
   (*Settings → Secrets and variables → Actions → New repository secret*).

Provenance attestations are emitted on every publish (`--provenance`). That works
because this repository is **public** and the workflow has `id-token: write`. If
the repo is ever made private, drop `--provenance` from the publish step (npm
provenance requires a public source repo).

## Cutting a release

1. Bump all four package versions in lockstep (no git tag yet):

   ```bash
   pnpm --filter "./packages/*" exec npm version <new-version> --no-git-tag-version
   # e.g. ... npm version 0.2.0 --no-git-tag-version
   ```

2. Commit the version bump and open/merge a PR to `main`:

   ```bash
   git commit -am "chore(release): v<new-version>"
   ```

3. Create a **GitHub Release** whose tag is `v<new-version>` (e.g. `v0.2.0`),
   targeting `main`. Publishing the Release triggers the workflow.

   ```bash
   gh release create v<new-version> --generate-notes
   ```

The workflow verifies the tag matches the package version, runs
lint → typecheck → build → test, then `pnpm -r publish --access public
--provenance`. `pnpm -r publish` walks the workspace in dependency order, rewrites
`workspace:*` to the concrete version, skips private packages (the repo root and
the `examples/*`), and skips any version already on the registry — so re-running a
release is safe.

## Testing the workflow without publishing

Use the **Run workflow** button (`workflow_dispatch`) on the Release workflow and
tick **dry-run**. It packs every package and prints the tarball contents but does
not publish.
