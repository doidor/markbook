import path from 'node:path';
import fs from 'node:fs/promises';
import ts from 'typescript';
import { codeToHtml } from 'shiki';

const fileCache = new Map<string, string | null>();

/** Invalidate the in-memory cache for one file (or all when omitted). */
export function invalidateCodeCache(absPath?: string): void {
  if (absPath === undefined) fileCache.clear();
  else fileCache.delete(absPath);
}

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
 * Read the source of a story file (and any CSS files it directly imports)
 * and Shiki-highlight each.
 *
 * The source view depends on `exportName`:
 *   - `'default'` (singleton `:::story` files) — return the WHOLE file so
 *     users see imports + helpers + the renderer alongside each other.
 *   - any other name (a `:::stories` fan-out, or a named singleton export) —
 *     return a slice consisting of (a) all `import` statements, (b) all
 *     non-export top-level statements (helpers, constants), and (c) the
 *     named export's declaration only. Other named exports in the same file
 *     are excluded. Type-only declarations (`type`, `interface`) are
 *     skipped. JSDoc above the export is preserved.
 *
 * Sibling CSS imports (`./Foo.module.css`) are surfaced as additional
 * `CodeFile`s in either mode.
 */
export async function extractStoryCode(
  absStoryFile: string,
  exportName: string,
): Promise<{ files: CodeFile[] } | null> {
  const source = await readCached(absStoryFile);
  if (source === null) return null;

  const storySource =
    exportName === 'default' ? source : (sliceExport(source, absStoryFile, exportName) ?? source);

  const files: CodeFile[] = [await toCodeFile(absStoryFile, storySource)];

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

/**
 * Build a per-export source slice for multi-export story files. Returns
 * `null` if the named export can't be found — the caller falls back to the
 * whole file.
 *
 * The slice preserves source order: imports first (as written), then the
 * interleaved non-export helpers and the target export. We capture each
 * statement via `getFullStart()` so leading comments / JSDoc attach to the
 * statement they belong to.
 */
function sliceExport(source: string, fileName: string, exportName: string): string | null {
  const scriptKind = pickScriptKind(fileName);
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, scriptKind);

  interface Range {
    start: number;
    end: number;
  }
  const kept: Range[] = [];
  let foundExport = false;

  for (const stmt of sf.statements) {
    if (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) continue;

    if (ts.isImportDeclaration(stmt)) {
      kept.push({ start: stmt.getFullStart(), end: stmt.end });
      continue;
    }

    if (hasExportModifier(stmt)) {
      if (declaresExportName(stmt, exportName)) {
        kept.push({ start: stmt.getFullStart(), end: stmt.end });
        foundExport = true;
      }
      continue;
    }

    if (ts.isExportDeclaration(stmt)) {
      if (matchesNamedExport(stmt, exportName)) {
        kept.push({ start: stmt.getFullStart(), end: stmt.end });
        foundExport = true;
      }
      continue;
    }

    // Non-export top-level statement (variable, function, class, expression
    // statement) — keep as a potential helper used by the target export.
    kept.push({ start: stmt.getFullStart(), end: stmt.end });
  }

  if (!foundExport) return null;

  kept.sort((a, b) => a.start - b.start);
  const out = kept
    .map((r) => source.slice(r.start, r.end))
    .join('')
    .replace(/^\s+/, '');
  return out;
}

function hasExportModifier(node: ts.Node): boolean {
  const mods = (node as ts.HasModifiers).modifiers;
  if (!mods) return false;
  return mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function declaresExportName(stmt: ts.Statement, name: string): boolean {
  if (ts.isVariableStatement(stmt)) {
    return stmt.declarationList.declarations.some(
      (decl) => ts.isIdentifier(decl.name) && decl.name.text === name,
    );
  }
  if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) {
    return !!stmt.name && stmt.name.text === name;
  }
  if (ts.isEnumDeclaration(stmt)) {
    return stmt.name.text === name;
  }
  return false;
}

function matchesNamedExport(stmt: ts.ExportDeclaration, name: string): boolean {
  if (stmt.isTypeOnly) return false;
  if (!stmt.exportClause || !ts.isNamedExports(stmt.exportClause)) return false;
  return stmt.exportClause.elements.some((spec) => !spec.isTypeOnly && spec.name.text === name);
}

function pickScriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (fileName.endsWith('.js')) return ts.ScriptKind.JS;
  if (fileName.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.Unknown;
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
