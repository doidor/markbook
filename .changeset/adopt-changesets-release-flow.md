---
"@doidor/markbook": patch
---

Adopt Changesets for releases. `pnpm changeset` records changes; merging the
auto-opened "Version Packages" PR publishes all four `@doidor/markbook*`
packages in lockstep, tokenlessly via OIDC trusted publishing. The previous
GitHub-Release-triggered flow and the `release:version` helper are removed.
