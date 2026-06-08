# Releasing

Markbook is published to npm as four packages under the `@doidor` scope, versioned
in lockstep:

- [`@doidor/markbook`](packages/cli) (the CLI)
- [`@doidor/markbook-core`](packages/core)
- [`@doidor/markbook-adapter-react`](packages/adapter-react)
- [`@doidor/markbook-adapter-shared`](packages/adapter-shared)

Publishing runs in CI via [`.github/workflows/release.yml`](.github/workflows/release.yml)
using npm **trusted publishing** (OIDC) — there is no `NPM_TOKEN` secret and no
manual `npm publish` step.

## One-time setup

### 1. Bootstrap the first publish (token, once per package)

npm does **not** allow the very first publish of a brand-new package over OIDC,
so each package's `0.x` debut has to be published once with a token. Easiest:
create an npm **Automation** token (npmjs.com → *Access Tokens* → *Generate New
Token* → *Classic Token* → **Automation** — it bypasses 2FA), then from a clean
checkout of `main`:

```bash
pnpm install --frozen-lockfile && pnpm build
echo "//registry.npmjs.org/:_authToken=<AUTOMATION_TOKEN>" > ~/.npmrc
pnpm -r publish --access public --no-git-checks
```

This creates all four packages on npm. (You can instead do this via a temporary
token-based CI run — but the four packages only need bootstrapping once, ever.)

### 2. Configure a trusted publisher for each package

For **each** of the four packages, open
`https://www.npmjs.com/package/<name>/access` → **Trusted Publisher** → select
**GitHub Actions** and fill in:

| Field | Value |
| --- | --- |
| Organization or user | `doidor` |
| Repository | `markbook` |
| Workflow filename | `release.yml` |
| Environment | *(leave blank)* |

The package's `repository.url` in `package.json` already points at
`github.com/doidor/markbook`, which OIDC validation also checks.

### 3. (Recommended) Lock down tokens

Once trusted publishing works, on each package's **Settings → Publishing access**
choose **"Require two-factor authentication and disallow tokens"**, then revoke
the bootstrap automation token. Trusted publishing keeps working (it uses OIDC,
not tokens).

Provenance attestations are emitted on every publish (`--provenance`), which
works because this repository is **public** and the workflow has
`id-token: write`. If the repo is ever made private, drop `--provenance` (npm
provenance requires a public source repo).

## Cutting a release

> **Order matters: bump → commit → *then* create the Release.** The Git tag must
> point at the commit that already contains the bumped versions. The workflow
> fails fast if the tag (`v0.2.0`) and the package versions (`0.2.0`) disagree.

1. Bump all four packages in lockstep (edits `package.json` only — no commit, no
   tag):

   ```bash
   pnpm release:version <new-version>
   # e.g. pnpm release:version 0.2.0
   ```

2. Commit the version bump and get it onto `main` (directly or via a merged PR):

   ```bash
   git commit -am "chore(release): v<new-version>"
   git push
   ```

3. **Only now** create a **GitHub Release** whose tag is `v<new-version>` (e.g.
   `v0.2.0`), targeting `main` — so the tag lands on the bump commit. Publishing
   the Release triggers the workflow.

   ```bash
   gh release create v<new-version> --generate-notes --target main
   ```

The workflow verifies the tag matches the package version, runs
lint → typecheck → build → test, then `pnpm -r publish --access public
--provenance`. `pnpm -r publish` walks the workspace in dependency order, rewrites
`workspace:*` to the concrete version, skips private packages (the repo root and
the `examples/*`), and skips any version already on the registry — so re-running a
release is safe.

## Recovering from a "tag does not match version" failure

If you tagged/released **before** bumping (so `v0.2.0` points at a `0.1.x`
commit), the tag-check fails. Re-running won't help until the tag points at a
bumped commit. Fix it by bumping, then re-pointing the release:

```bash
pnpm release:version 0.2.0
git commit -am "chore(release): v0.2.0" && git push
gh release delete v0.2.0 --yes --cleanup-tag   # drops the stale tag
gh release create v0.2.0 --generate-notes --target main
```

## Testing the workflow without publishing

Use the **Run workflow** button (`workflow_dispatch`) on the Release workflow and
tick **dry-run**. It packs every package and prints the tarball contents but does
not publish.
