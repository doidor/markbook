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
