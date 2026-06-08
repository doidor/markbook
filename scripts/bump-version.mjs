#!/usr/bin/env node
/**
 * scripts/bump-version.mjs
 *
 * Bump every publishable @doidor/markbook* package to the same version, in
 * lockstep. Used by `pnpm release:version <version>`.
 *
 *   pnpm release:version 0.2.0
 *
 * It only edits the `version` field of the four published packages (the repo
 * root and the private examples are left at 0.0.0). It does NOT commit or tag —
 * the release flow is: bump -> commit -> create the GitHub Release whose tag is
 * `v<version>` (see RELEASING.md). The Release workflow refuses to publish if
 * the tag and these versions disagree.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PACKAGES = ['cli', 'core', 'adapter-react', 'adapter-shared'];
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

const version = process.argv[2];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!version) {
  console.error('Usage: pnpm release:version <version>   (e.g. pnpm release:version 0.2.0)');
  process.exit(1);
}
if (!SEMVER.test(version)) {
  console.error(`Invalid version "${version}". Expected a semver string like 0.2.0 or 1.0.0-rc.1.`);
  process.exit(1);
}

for (const pkg of PACKAGES) {
  const file = path.join(repoRoot, 'packages', pkg, 'package.json');
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const from = json.version;
  json.version = version;
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`  ${json.name}: ${from} -> ${version}`);
}

console.log(`\nBumped ${PACKAGES.length} packages to ${version}.`);
console.log('Next: commit, push to main, then create a GitHub Release tagged ' + `v${version}.`);
