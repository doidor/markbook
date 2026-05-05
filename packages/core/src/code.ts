import path from 'node:path';
import fs from 'node:fs/promises';
import { codeToHtml } from 'shiki';

const fileCache = new Map<string, string | null>();

export interface CodeFile {
  /** File name shown above the block (e.g. `Variants.stories.tsx`). */
  label: string;
  /** Language id passed to Shiki. */
  lang: string;
  /** Raw source. */
  code: string;
  /** Shiki dual-theme HTML. */
  codeHtml: string;
}

/**
 * Read the full source of the story file (and any CSS files it directly
 * imports) and Shiki-highlight each. The convention is one story per file (with
 * a `default` export) so the entire file IS the story — users see the imports
 * and any helpers alongside the story body. Sibling CSS imports are surfaced so
 * style rules live next to the JSX that uses them in the docs.
 *
 * `exportName` is accepted for API compatibility with the generated entry's
 * import statement but is not used to slice the source.
 */
export async function extractStoryCode(
  absStoryFile: string,
  _exportName: string,
): Promise<{ files: CodeFile[] } | null> {
  const source = await readCached(absStoryFile);
  if (source === null) return null;

  const files: CodeFile[] = [await toCodeFile(absStoryFile, source)];

  const seen = new Set<string>([absStoryFile]);
  for (const spec of importSpecifiers(source)) {
    if (!isStyleSpecifier(spec)) continue;
    if (!spec.startsWith('./') && !spec.startsWith('../') && !path.isAbsolute(spec)) continue;
    const abs = path.resolve(path.dirname(absStoryFile), spec);
    if (seen.has(abs)) continue;
    seen.add(abs);
    const styleSource = await readCached(abs);
    if (styleSource === null) continue;
    files.push(await toCodeFile(abs, styleSource));
  }

  return { files };
}

async function readCached(absPath: string): Promise<string | null> {
  if (fileCache.has(absPath)) return fileCache.get(absPath) ?? null;
  try {
    const text = await fs.readFile(absPath, 'utf8');
    fileCache.set(absPath, text);
    return text;
  } catch {
    fileCache.set(absPath, null);
    return null;
  }
}

async function toCodeFile(absPath: string, source: string): Promise<CodeFile> {
  const code = source.trim();
  const lang = langFor(absPath);
  const codeHtml = await codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
  return { label: path.basename(absPath), lang, code, codeHtml };
}

function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const re = /(?:^|[\s;])import\s+(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const m of source.matchAll(re)) {
    if (m[1]) specs.push(m[1]);
  }
  return specs;
}

function isStyleSpecifier(spec: string): boolean {
  return /\.(css|scss|sass|less|styl|pcss)(\?[^?]*)?$/i.test(spec);
}

function langFor(filePath: string): string {
  if (filePath.endsWith('.tsx')) return 'tsx';
  if (filePath.endsWith('.jsx')) return 'jsx';
  if (filePath.endsWith('.js')) return 'js';
  if (filePath.endsWith('.scss')) return 'scss';
  if (filePath.endsWith('.sass')) return 'sass';
  if (filePath.endsWith('.less')) return 'less';
  if (filePath.endsWith('.styl')) return 'stylus';
  if (filePath.endsWith('.pcss') || filePath.endsWith('.css')) return 'css';
  return 'ts';
}
