import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Distribute user-facing agent skills shipped with the `markbook` npm
 * package into the consumer project's vendor-CLI surfaces.
 *
 * Design choices (see ADR-0022):
 *
 *   - **Copy by default, symlink opt-in.** Symlinks dangle on pnpm
 *     `node_modules/.pnpm/<hash>` paths and on Windows. Copying is more
 *     robust; the `.markbook-skill.json` metadata file written alongside
 *     each installed skill lets us detect staleness deterministically.
 *
 *   - **Flat namespace.** Skills land at `<vendor>/skills/markbook-<name>/`
 *     rather than nested under a `markbook/` namespace dir. Cross-vendor
 *     namespace support is uneven; the flat form works everywhere.
 *
 *   - **Detect surfaces, don't create them.** Only install into vendor dirs
 *     that already exist in the target project. If none exist, default to
 *     `.claude/skills/` (the most common today) and print a tip pointing
 *     at the other supported surfaces.
 *
 *   - **`--update` is metadata-aware.** Only overwrites installed dirs that
 *     carry a `.markbook-skill.json` matching ours. User-customized or
 *     unmanaged directories under the same name are refused unless
 *     `--force` is supplied.
 */

const VENDOR_SURFACES = ['.claude', '.codex', '.opencode', '.agents'] as const;
type VendorSurface = (typeof VENDOR_SURFACES)[number];

interface InstalledSkillMetadata {
  /** Stable id; matches `name:` frontmatter inside the SKILL.md. */
  name: string;
  /** Source markbook version. Lets `--update` detect bumps. */
  markbookVersion: string;
  /** Content hash of the skill directory's files. Detects local edits. */
  contentHash: string;
  /** When the skill was installed/updated, ISO 8601. */
  installedAt: string;
  /** Where the canonical source lives. Informational; not used at runtime. */
  source: string;
}

const METADATA_FILE = '.markbook-skill.json';

export interface InstallOptions {
  /** Project root the install targets. Defaults to cwd. */
  cwd?: string;
  /** Force copy even when symlinks are available. Default: true (copy is the default). */
  copy?: boolean;
  /** Opt-in to symlinks instead of copying. Default: false. */
  symlink?: boolean;
  /** Limit to a single surface. Default: every vendor surface that exists in the target. */
  surface?: VendorSurface;
  /** Overwrite metadata-managed skills even if their content hash differs. */
  update?: boolean;
  /** Overwrite ANY existing skill directory (even unmanaged). Use with care. */
  force?: boolean;
}

export interface InstallResult {
  surface: VendorSurface;
  /** Per-skill outcome. */
  skills: Array<{
    name: string;
    action:
      | 'installed'
      | 'updated'
      | 'skipped-up-to-date'
      | 'skipped-unmanaged'
      | 'skipped-modified';
    path: string;
    reason?: string;
  }>;
}

/**
 * Locate the package's `skills/` directory. Two paths:
 *
 *   1. **Running from a real install** — `node_modules/markbook/skills/`
 *      relative to the CLI's own __dirname, walked up to find `package.json`.
 *   2. **Workspace dev** — `packages/cli/skills/` if the CLI was launched
 *      from a workspace build. We resolve via `import.meta.url` then walk
 *      up the dist tree until we find `skills/` next to `dist/`.
 */
export async function findShippedSkillsDir(): Promise<string> {
  const cliFile = fileURLToPath(import.meta.url);
  let dir = path.dirname(cliFile);
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'skills');
    if (await isDirectory(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    'Markbook: could not locate the package skills directory. ' +
      `Walked up from ${cliFile} without finding a sibling \`skills/\`. ` +
      'Is the package installation complete?',
  );
}

/** Read the markbook package's version from its package.json (sibling of skills/). */
export async function readShippedMarkbookVersion(skillsDir: string): Promise<string> {
  const pkgPath = path.join(path.dirname(skillsDir), 'package.json');
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Returns every supported vendor surface dir that exists in the project root. */
export async function detectVendorSurfaces(cwd: string): Promise<VendorSurface[]> {
  const out: VendorSurface[] = [];
  for (const surface of VENDOR_SURFACES) {
    if (await isDirectory(path.join(cwd, surface))) out.push(surface);
  }
  return out;
}

/** List every shipped skill (directory containing a SKILL.md). */
export async function listShippedSkills(skillsDir: string): Promise<string[]> {
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillFile = path.join(skillsDir, e.name, 'SKILL.md');
    if (await isFile(skillFile)) out.push(e.name);
  }
  return out.sort();
}

/**
 * Install every shipped skill into every selected vendor surface.
 *
 * Returns one result per surface so the CLI can render a tidy summary.
 */
export async function installAll(opts: InstallOptions = {}): Promise<InstallResult[]> {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const skillsDir = await findShippedSkillsDir();
  const version = await readShippedMarkbookVersion(skillsDir);
  const skills = await listShippedSkills(skillsDir);

  let surfaces: VendorSurface[];
  if (opts.surface) {
    surfaces = [opts.surface];
    // Create on demand when explicitly targeted.
    await fs.mkdir(path.join(cwd, opts.surface), { recursive: true });
  } else {
    const detected = await detectVendorSurfaces(cwd);
    if (detected.length === 0) {
      // Fallback: default to .claude as the most common surface today.
      await fs.mkdir(path.join(cwd, '.claude'), { recursive: true });
      surfaces = ['.claude'];
    } else {
      surfaces = detected;
    }
  }

  const useSymlink = !!opts.symlink && process.platform !== 'win32';

  const results: InstallResult[] = [];
  for (const surface of surfaces) {
    const surfaceSkillsDir = path.join(cwd, surface, 'skills');
    await fs.mkdir(surfaceSkillsDir, { recursive: true });
    const surfaceResult: InstallResult = { surface, skills: [] };

    for (const name of skills) {
      const sourceDir = path.join(skillsDir, name);
      const destName = `markbook-${name}`;
      const destDir = path.join(surfaceSkillsDir, destName);
      const outcome = await installOne({
        sourceDir,
        destDir,
        name: destName,
        version,
        useSymlink,
        force: !!opts.force,
        update: !!opts.update,
      });
      surfaceResult.skills.push({ ...outcome, path: destDir });
    }
    results.push(surfaceResult);
  }

  return results;
}

interface InstallOneInput {
  sourceDir: string;
  destDir: string;
  name: string;
  version: string;
  useSymlink: boolean;
  force: boolean;
  update: boolean;
}

interface InstallOneOutcome {
  name: string;
  action: 'installed' | 'updated' | 'skipped-up-to-date' | 'skipped-unmanaged' | 'skipped-modified';
  reason?: string;
}

async function installOne(input: InstallOneInput): Promise<InstallOneOutcome> {
  const { sourceDir, destDir, name, version, useSymlink, force, update } = input;
  const sourceHash = await hashDirectory(sourceDir);
  const targetMetadata = await readMetadata(destDir);

  if (targetMetadata === null) {
    // Destination doesn't exist OR exists without metadata.
    const exists = await isDirectory(destDir);
    if (exists && !force) {
      return {
        name,
        action: 'skipped-unmanaged',
        reason: `${destDir} exists but lacks a ${METADATA_FILE}; use --force to overwrite.`,
      };
    }
    if (exists) await fs.rm(destDir, { recursive: true, force: true });
    if (useSymlink) {
      await symlinkSkill(sourceDir, destDir);
    } else {
      await copyDirectory(sourceDir, destDir);
    }
    await writeMetadata(destDir, {
      name,
      markbookVersion: version,
      contentHash: sourceHash,
      installedAt: new Date().toISOString(),
      source: sourceDir,
    });
    return { name, action: 'installed' };
  }

  // Destination exists with metadata.
  if (targetMetadata.contentHash === sourceHash) {
    return { name, action: 'skipped-up-to-date' };
  }

  // Content differs. Either we're updating (refresh) or skipping (user
  // edited the installed copy).
  if (!update) {
    return {
      name,
      action: 'skipped-modified',
      reason: 'installed copy differs from shipped; pass --update to refresh.',
    };
  }

  await fs.rm(destDir, { recursive: true, force: true });
  if (useSymlink) {
    await symlinkSkill(sourceDir, destDir);
  } else {
    await copyDirectory(sourceDir, destDir);
  }
  await writeMetadata(destDir, {
    name,
    markbookVersion: version,
    contentHash: sourceHash,
    installedAt: new Date().toISOString(),
    source: sourceDir,
  });
  return { name, action: 'updated' };
}

async function symlinkSkill(sourceDir: string, destDir: string): Promise<void> {
  const parent = path.dirname(destDir);
  // Use a relative target so the link survives when the project is moved
  // (as long as node_modules/ comes along with it).
  const relTarget = path.relative(parent, sourceDir);
  await fs.symlink(relTarget, destDir);
}

async function copyDirectory(src: string, dst: string): Promise<void> {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, dstPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, dstPath);
    }
  }
}

/**
 * Stable content hash of every file under a directory. Order-independent;
 * file names + contents both feed in so a rename counts as a change.
 */
async function hashDirectory(dir: string): Promise<string> {
  const files: string[] = [];
  async function walk(d: string, prefix: string): Promise<void> {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      const rel = path.posix.join(prefix, entry.name);
      const abs = path.join(d, entry.name);
      if (entry.isDirectory()) await walk(abs, rel);
      else if (entry.isFile()) files.push(rel);
    }
  }
  await walk(dir, '');
  files.sort();
  const hash = createHash('sha256');
  for (const rel of files) {
    hash.update(rel);
    hash.update('\0');
    const content = await fs.readFile(path.join(dir, ...rel.split('/')));
    hash.update(content);
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function readMetadata(dir: string): Promise<InstalledSkillMetadata | null> {
  try {
    const raw = await fs.readFile(path.join(dir, METADATA_FILE), 'utf8');
    return JSON.parse(raw) as InstalledSkillMetadata;
  } catch {
    return null;
  }
}

async function writeMetadata(dir: string, meta: InstalledSkillMetadata): Promise<void> {
  await fs.writeFile(path.join(dir, METADATA_FILE), `${JSON.stringify(meta, null, 2)}\n`);
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function isFile(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

/** Pretty-print one InstallResult to stdout. */
export function formatInstallResults(results: InstallResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    lines.push(`${r.surface}/skills/`);
    for (const s of r.skills) {
      const tag =
        s.action === 'installed' || s.action === 'updated'
          ? '✓'
          : s.action === 'skipped-up-to-date'
            ? '·'
            : '!';
      const detail = s.reason ? ` — ${s.reason}` : '';
      lines.push(`  ${tag} ${s.name} (${s.action})${detail}`);
    }
  }
  return lines.join('\n');
}

/** Summary used by `markbook skills list`. */
export async function listInstalled(cwd: string): Promise<{
  shipped: string[];
  perSurface: Array<{ surface: VendorSurface; installed: string[]; outOfDate: string[] }>;
}> {
  const skillsDir = await findShippedSkillsDir();
  const shipped = await listShippedSkills(skillsDir);
  const surfaces = await detectVendorSurfaces(cwd);
  const perSurface: Array<{
    surface: VendorSurface;
    installed: string[];
    outOfDate: string[];
  }> = [];
  for (const surface of surfaces) {
    const surfaceSkillsDir = path.join(cwd, surface, 'skills');
    if (!(await isDirectory(surfaceSkillsDir))) {
      perSurface.push({ surface, installed: [], outOfDate: [] });
      continue;
    }
    const installed: string[] = [];
    const outOfDate: string[] = [];
    for (const name of shipped) {
      const destName = `markbook-${name}`;
      const destDir = path.join(surfaceSkillsDir, destName);
      const meta = await readMetadata(destDir);
      if (!meta) continue;
      installed.push(name);
      const sourceHash = await hashDirectory(path.join(skillsDir, name));
      if (sourceHash !== meta.contentHash) outOfDate.push(name);
    }
    perSurface.push({ surface, installed, outOfDate });
  }
  return { shipped, perSurface };
}
