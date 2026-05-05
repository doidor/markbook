import fs from 'node:fs/promises';
import { codeToHtml } from 'shiki';

const sourceCache = new Map<string, string>();

/**
 * Read the full source of the story file and highlight it. The convention is
 * one story per file (with a `default` export, or a named export referenced
 * via the directive's `export=` attribute) so the entire file IS the story —
 * users see the imports and any helpers alongside the story body.
 *
 * `exportName` is accepted for API compatibility with the generated entry's
 * import statement but is not used to slice the source.
 */
export async function extractStoryCode(
  absStoryFile: string,
  _exportName: string,
): Promise<{ code: string; codeHtml: string } | null> {
  let source = sourceCache.get(absStoryFile);
  if (!source) {
    try {
      source = await fs.readFile(absStoryFile, 'utf8');
      sourceCache.set(absStoryFile, source);
    } catch {
      return null;
    }
  }

  const code = source.trim();
  const codeHtml = await codeToHtml(code, {
    lang: langFor(absStoryFile),
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
  return { code, codeHtml };
}

function langFor(filePath: string): 'tsx' | 'jsx' | 'ts' | 'js' {
  if (filePath.endsWith('.tsx')) return 'tsx';
  if (filePath.endsWith('.jsx')) return 'jsx';
  if (filePath.endsWith('.js')) return 'js';
  return 'ts';
}
