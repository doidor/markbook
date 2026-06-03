import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { formatInstallResults, hashDirectory, installAll, listInstalled } from './skills.js';

/**
 * The skills installer copies shipped skills from `<cli-package>/skills/`
 * into the consumer's vendor-CLI surfaces. These tests stand up a synthetic
 * "shipped skills" directory and an empty project root in tmpdir, then
 * exercise the installer against both. Everything is hermetic — no real
 * `node_modules` lookup, no dependence on the live shipped skill content.
 */

interface Fixture {
  root: string;
  source: string;
}

async function makeFixture(): Promise<Fixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-skills-test-'));
  const source = path.join(root, 'fixture-skills');
  await fs.mkdir(source, { recursive: true });
  // Two synthetic skills.
  await fs.mkdir(path.join(source, 'alpha'), { recursive: true });
  await fs.writeFile(path.join(source, 'alpha', 'SKILL.md'), '---\nname: alpha\n---\n# Alpha\n');
  await fs.mkdir(path.join(source, 'beta'), { recursive: true });
  await fs.writeFile(path.join(source, 'beta', 'SKILL.md'), '---\nname: beta\n---\n# Beta\n');
  await fs.writeFile(path.join(source, 'beta', 'helper.css'), '.beta { color: red; }');
  // Non-skill sibling at the source root — must be filtered out (no SKILL.md).
  await fs.mkdir(path.join(source, 'not-a-skill'), { recursive: true });
  await fs.writeFile(path.join(source, 'not-a-skill', 'readme.txt'), 'noise');
  // Synthetic package.json so readShippedMarkbookVersion has something.
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'markbook', version: '1.2.3' }),
  );
  // Project root is the temp dir itself; surfaces are siblings of fixture-skills.
  return { root, source };
}

let fix: Fixture;
beforeEach(async () => {
  fix = await makeFixture();
});
afterEach(async () => {
  await fs.rm(fix.root, { recursive: true, force: true });
});

describe('hashDirectory', () => {
  it('returns the same hash for identical directory contents', async () => {
    const a = await hashDirectory(path.join(fix.source, 'alpha'));
    const b = await hashDirectory(path.join(fix.source, 'alpha'));
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns different hashes when content differs', async () => {
    const a = await hashDirectory(path.join(fix.source, 'alpha'));
    await fs.appendFile(path.join(fix.source, 'alpha', 'SKILL.md'), '\nedit\n');
    const b = await hashDirectory(path.join(fix.source, 'alpha'));
    expect(a).not.toBe(b);
  });

  it('reflects file additions', async () => {
    const a = await hashDirectory(path.join(fix.source, 'alpha'));
    await fs.writeFile(path.join(fix.source, 'alpha', 'new.css'), '.x { }');
    const b = await hashDirectory(path.join(fix.source, 'alpha'));
    expect(a).not.toBe(b);
  });
});

describe('installAll — fresh project', () => {
  it('falls back to .claude when no vendor surface exists', async () => {
    const results = await installAll({
      cwd: fix.root,
      sourceSkillsDir: fix.source,
      sourceVersion: '1.2.3',
    });
    expect(results.map((r) => r.surface)).toEqual(['.claude']);
    expect(results[0]!.skills.map((s) => s.name).sort()).toEqual([
      'markbook-alpha',
      'markbook-beta',
    ]);
    for (const s of results[0]!.skills) expect(s.action).toBe('installed');
  });

  it('lands a SKILL.md and a .markbook-skill.json per installed skill', async () => {
    await installAll({ cwd: fix.root, sourceSkillsDir: fix.source, sourceVersion: '1.2.3' });
    const dest = path.join(fix.root, '.claude/skills/markbook-alpha');
    await fs.access(path.join(dest, 'SKILL.md'));
    const meta = JSON.parse(await fs.readFile(path.join(dest, '.markbook-skill.json'), 'utf8'));
    expect(meta.name).toBe('markbook-alpha');
    expect(meta.markbookVersion).toBe('1.2.3');
    expect(meta.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(typeof meta.installedAt).toBe('string');
  });

  it('skips non-skill directories at the source root (no SKILL.md)', async () => {
    const results = await installAll({
      cwd: fix.root,
      sourceSkillsDir: fix.source,
      sourceVersion: '1.2.3',
    });
    const names = results[0]!.skills.map((s) => s.name);
    expect(names).not.toContain('markbook-not-a-skill');
  });
});

describe('installAll — surface detection', () => {
  it('installs into every existing vendor surface, none new', async () => {
    await fs.mkdir(path.join(fix.root, '.codex'));
    await fs.mkdir(path.join(fix.root, '.opencode'));
    const results = await installAll({
      cwd: fix.root,
      sourceSkillsDir: fix.source,
      sourceVersion: '1.2.3',
    });
    expect(results.map((r) => r.surface).sort()).toEqual(['.codex', '.opencode']);
    // No .claude got created since detection won.
    await expect(fs.access(path.join(fix.root, '.claude'))).rejects.toThrow();
  });

  it('--surface forces install into one specific vendor even when others exist', async () => {
    await fs.mkdir(path.join(fix.root, '.claude'));
    await fs.mkdir(path.join(fix.root, '.codex'));
    const results = await installAll({
      cwd: fix.root,
      sourceSkillsDir: fix.source,
      sourceVersion: '1.2.3',
      surface: '.codex',
    });
    expect(results.map((r) => r.surface)).toEqual(['.codex']);
    // Other surface untouched.
    await expect(fs.access(path.join(fix.root, '.claude/skills/markbook-alpha'))).rejects.toThrow();
  });

  it('--surface creates the surface dir on demand', async () => {
    const results = await installAll({
      cwd: fix.root,
      sourceSkillsDir: fix.source,
      sourceVersion: '1.2.3',
      surface: '.codex',
    });
    expect(results.map((r) => r.surface)).toEqual(['.codex']);
    await fs.access(path.join(fix.root, '.codex/skills/markbook-alpha'));
  });
});

describe('installAll — idempotency and refresh', () => {
  it('reports skipped-up-to-date for an unchanged second run', async () => {
    await installAll({ cwd: fix.root, sourceSkillsDir: fix.source, sourceVersion: '1.2.3' });
    const second = await installAll({
      cwd: fix.root,
      sourceSkillsDir: fix.source,
      sourceVersion: '1.2.3',
    });
    for (const s of second[0]!.skills) expect(s.action).toBe('skipped-up-to-date');
  });

  it('reports skipped-modified when source drifts and --update is not passed', async () => {
    await installAll({ cwd: fix.root, sourceSkillsDir: fix.source, sourceVersion: '1.2.3' });
    // Mutate the source so its hash changes.
    await fs.appendFile(path.join(fix.source, 'alpha', 'SKILL.md'), '\nnew content\n');
    const second = await installAll({
      cwd: fix.root,
      sourceSkillsDir: fix.source,
      sourceVersion: '1.2.4',
    });
    const alpha = second[0]!.skills.find((s) => s.name === 'markbook-alpha')!;
    expect(alpha.action).toBe('skipped-modified');
    expect(alpha.reason).toContain('--update');
    // The other skill (unchanged source) reports up-to-date.
    const beta = second[0]!.skills.find((s) => s.name === 'markbook-beta')!;
    expect(beta.action).toBe('skipped-up-to-date');
  });

  it('--update refreshes drifted skills and updates the metadata', async () => {
    await installAll({ cwd: fix.root, sourceSkillsDir: fix.source, sourceVersion: '1.2.3' });
    await fs.appendFile(path.join(fix.source, 'alpha', 'SKILL.md'), '\nnew\n');
    const second = await installAll({
      cwd: fix.root,
      sourceSkillsDir: fix.source,
      sourceVersion: '1.2.4',
      update: true,
    });
    const alpha = second[0]!.skills.find((s) => s.name === 'markbook-alpha')!;
    expect(alpha.action).toBe('updated');
    const meta = JSON.parse(
      await fs.readFile(
        path.join(fix.root, '.claude/skills/markbook-alpha/.markbook-skill.json'),
        'utf8',
      ),
    );
    expect(meta.markbookVersion).toBe('1.2.4');
    const installed = await fs.readFile(
      path.join(fix.root, '.claude/skills/markbook-alpha/SKILL.md'),
      'utf8',
    );
    expect(installed).toContain('new');
  });
});

describe('installAll — clobber safety', () => {
  it('refuses to overwrite an unmanaged dir (no metadata) without --force', async () => {
    const dest = path.join(fix.root, '.claude/skills/markbook-alpha');
    await fs.mkdir(dest, { recursive: true });
    await fs.writeFile(path.join(dest, 'SKILL.md'), '# I am user-authored\n');

    const results = await installAll({
      cwd: fix.root,
      sourceSkillsDir: fix.source,
      sourceVersion: '1.2.3',
    });
    const alpha = results[0]!.skills.find((s) => s.name === 'markbook-alpha')!;
    expect(alpha.action).toBe('skipped-unmanaged');
    expect(alpha.reason).toContain('--force');

    // User content intact
    const content = await fs.readFile(path.join(dest, 'SKILL.md'), 'utf8');
    expect(content).toBe('# I am user-authored\n');
  });

  it('--force overwrites unmanaged directories', async () => {
    const dest = path.join(fix.root, '.claude/skills/markbook-alpha');
    await fs.mkdir(dest, { recursive: true });
    await fs.writeFile(path.join(dest, 'SKILL.md'), '# replace me\n');

    const results = await installAll({
      cwd: fix.root,
      sourceSkillsDir: fix.source,
      sourceVersion: '1.2.3',
      force: true,
    });
    const alpha = results[0]!.skills.find((s) => s.name === 'markbook-alpha')!;
    expect(alpha.action).toBe('installed');
    const content = await fs.readFile(path.join(dest, 'SKILL.md'), 'utf8');
    expect(content).not.toBe('# replace me\n');
    expect(content).toContain('Alpha');
  });
});

describe('listInstalled', () => {
  it('lists shipped skills and per-surface install state', async () => {
    await installAll({ cwd: fix.root, sourceSkillsDir: fix.source, sourceVersion: '1.2.3' });
    const summary = await listInstalled(fix.root, fix.source);
    expect(summary.shipped.sort()).toEqual(['alpha', 'beta']);
    expect(summary.perSurface).toHaveLength(1);
    expect(summary.perSurface[0]!.surface).toBe('.claude');
    expect(summary.perSurface[0]!.installed.sort()).toEqual(['alpha', 'beta']);
    expect(summary.perSurface[0]!.outOfDate).toEqual([]);
  });

  it('flags out-of-date installs when shipped content drifts', async () => {
    await installAll({ cwd: fix.root, sourceSkillsDir: fix.source, sourceVersion: '1.2.3' });
    await fs.appendFile(path.join(fix.source, 'alpha', 'SKILL.md'), '\ndrift\n');
    const summary = await listInstalled(fix.root, fix.source);
    expect(summary.perSurface[0]!.outOfDate).toEqual(['alpha']);
  });

  it('reports empty perSurface when no vendor surfaces exist', async () => {
    // Force the source to be discoverable but don't actually install
    const summary = await listInstalled(fix.root, fix.source);
    expect(summary.shipped.sort()).toEqual(['alpha', 'beta']);
    expect(summary.perSurface).toEqual([]);
  });
});

describe('formatInstallResults', () => {
  it('groups output by surface with per-skill action tags', () => {
    const out = formatInstallResults([
      {
        surface: '.claude',
        skills: [
          { name: 'markbook-alpha', action: 'installed', path: '/x/.claude/skills/markbook-alpha' },
          {
            name: 'markbook-beta',
            action: 'skipped-up-to-date',
            path: '/x/.claude/skills/markbook-beta',
          },
        ],
      },
    ]);
    expect(out).toContain('.claude/skills/');
    expect(out).toContain('✓ markbook-alpha (installed)');
    expect(out).toContain('· markbook-beta (skipped-up-to-date)');
  });

  it('renders the reason when present', () => {
    const out = formatInstallResults([
      {
        surface: '.claude',
        skills: [
          {
            name: 'markbook-alpha',
            action: 'skipped-unmanaged',
            path: '/x',
            reason: 'pass --force',
          },
        ],
      },
    ]);
    expect(out).toContain('— pass --force');
  });
});
