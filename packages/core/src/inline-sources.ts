import path from 'node:path';
import fs from 'node:fs/promises';
import { glob } from 'tinyglobby';
import { isPathLikeSpec } from './resolve.js';
import { extractModuleSpecifiers } from './ts-utils.js';

export interface InlinedFile {
  /** Absolute path on disk. */
  absPath: string;
  /** Path relative to the inlining root (typically `MarkbookConfig.root`). */
  relPath: string;
  /** File source. */
  content: string;
}

interface ResolveOptions {
  /** Absolute path of the story file to start from. */
  storyAbsPath: string;
  /** Root the relative paths are computed against (usually `ctx.root`). */
  root: string;
  /**
   * Glob patterns matched against `root`-relative paths. Only files whose
   * resolved path matches at least one of these globs are inlined.
   */
  inlinePatterns: string[];
}

const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'];
const STYLE_EXTENSIONS = ['.css', '.scss', '.sass', '.less', '.styl', '.pcss'];

/**
 * Walk the story file's relative imports recursively. Every file that
 * resolves to a real path AND matches one of the inline globs (relative to
 * `root`) is included. Follows transitive relative imports inside those
 * files too. Bare specifiers (e.g. `'react'`) are skipped — they belong in
 * the sandbox's `package.json` dependencies.
 *
 * The story file itself is NOT returned (the caller already has it in
 * `codeFiles`). Only NEW inlined files are produced.
 */
export async function resolveInlinedSources(opts: ResolveOptions): Promise<InlinedFile[]> {
  if (opts.inlinePatterns.length === 0) return [];

  const eligibleSet = await buildEligibleSet(opts.root, opts.inlinePatterns);
  if (eligibleSet.size === 0) return [];

  const visited = new Set<string>([opts.storyAbsPath]);
  const queue: string[] = [opts.storyAbsPath];
  const out: InlinedFile[] = [];

  while (queue.length > 0) {
    const absPath = queue.shift()!;
    const source = await readOrNull(absPath);
    if (source === null) continue;

    const fromDir = path.dirname(absPath);
    for (const spec of extractModuleSpecifiers(source, absPath, { includeExports: true })) {
      if (!isPathLikeSpec(spec)) continue;

      const resolved = await resolveImport(fromDir, spec);
      if (resolved === null) continue;
      if (visited.has(resolved)) continue;

      // Only inline files that are matched by the user's globs — we use
      // the eligible set as the gate so a story can't drag in arbitrary
      // source from elsewhere in the repo just because the path resolved.
      if (!eligibleSet.has(resolved)) continue;

      visited.add(resolved);
      const content = await readOrNull(resolved);
      if (content === null) continue;

      out.push({
        absPath: resolved,
        relPath: path.relative(opts.root, resolved),
        content,
      });
      queue.push(resolved);
    }
  }

  return out;
}

async function buildEligibleSet(root: string, patterns: string[]): Promise<Set<string>> {
  const matches = await glob(patterns, { cwd: root, absolute: true });
  return new Set(matches);
}

/**
 * Resolve an import specifier from `fromDir` to an absolute file path. Tries
 * the literal path first, then swaps common extensions — `'./Foo.js'` is
 * frequently authored to resolve to `Foo.ts` or `Foo.tsx` at build time
 * (Node's NodeNext resolution convention). Returns null when no candidate
 * exists.
 */
async function resolveImport(fromDir: string, spec: string): Promise<string | null> {
  const abs = path.resolve(fromDir, spec);

  // Direct hit
  if (await isFile(abs)) return abs;

  // `./Foo.js` → `./Foo.ts` / `./Foo.tsx` (TS NodeNext convention)
  if (abs.endsWith('.js')) {
    for (const ext of ['.ts', '.tsx']) {
      const swapped = `${abs.slice(0, -3)}${ext}`;
      if (await isFile(swapped)) return swapped;
    }
  }
  if (abs.endsWith('.jsx')) {
    const swapped = `${abs.slice(0, -4)}.tsx`;
    if (await isFile(swapped)) return swapped;
  }

  // No extension? Try common ones.
  if (!path.extname(abs)) {
    for (const ext of [...SOURCE_EXTENSIONS, ...STYLE_EXTENSIONS]) {
      if (await isFile(`${abs}${ext}`)) return `${abs}${ext}`;
    }
    // `./components` → `./components/index.ts(x)`
    for (const ext of SOURCE_EXTENSIONS) {
      if (await isFile(path.join(abs, `index${ext}`))) {
        return path.join(abs, `index${ext}`);
      }
    }
  }

  return null;
}

async function isFile(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function readOrNull(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
}
