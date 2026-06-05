import fs from 'node:fs/promises';
import ts from 'typescript';
import { hasExportModifier, pickScriptKind } from './ts-utils.js';

const exportsCache = new Map<string, string[] | null>();

/**
 * Reserved names that must NOT be treated as story exports. They are the
 * module-level story metadata fields (`args`, `argTypes`, `parameters`) plus
 * the implicit `default` export which has its own directive (`:::story`).
 */
const RESERVED_EXPORT_NAMES = new Set(['default', 'args', 'argTypes', 'parameters']);

/**
 * Discover runtime value exports of a TypeScript/JavaScript story file.
 *
 * Returns the names of named exports that are runtime values (functions,
 * variables, classes). Excludes `default`, `args`, `argTypes`, `parameters`,
 * private names (leading underscore), and pure type/interface exports.
 *
 * The exports are returned in source order so `:::stories` fan-out preserves
 * the author's intended ordering.
 */
export async function discoverStoryExports(absStoryFile: string): Promise<string[] | null> {
  if (exportsCache.has(absStoryFile)) return exportsCache.get(absStoryFile) ?? null;
  let source: string;
  try {
    source = await fs.readFile(absStoryFile, 'utf8');
  } catch {
    exportsCache.set(absStoryFile, null);
    return null;
  }
  const names = collectRuntimeExports(source, absStoryFile);
  exportsCache.set(absStoryFile, names);
  return names;
}

/** Invalidate the in-memory cache for one file (or all files when omitted). */
export function invalidateExportsCache(absStoryFile?: string): void {
  if (absStoryFile === undefined) exportsCache.clear();
  else exportsCache.delete(absStoryFile);
}

function collectRuntimeExports(source: string, fileName: string): string[] {
  const scriptKind = pickScriptKind(fileName);
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, scriptKind);
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (name: string) => {
    if (RESERVED_EXPORT_NAMES.has(name)) return;
    if (name.startsWith('_')) return;
    if (seen.has(name)) return;
    seen.add(name);
    out.push(name);
  };

  for (const stmt of sf.statements) {
    // export type / export interface — type-only, skip
    if (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) continue;

    if (!hasExportModifier(stmt)) {
      // `export { Foo }` lives in ExportDeclaration without a modifier
      if (
        ts.isExportDeclaration(stmt) &&
        stmt.exportClause &&
        ts.isNamedExports(stmt.exportClause)
      ) {
        if (stmt.isTypeOnly) continue;
        for (const spec of stmt.exportClause.elements) {
          if (spec.isTypeOnly) continue;
          push(spec.name.text);
        }
      }
      continue;
    }

    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) push(decl.name.text);
      }
    } else if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) {
      if (stmt.name) push(stmt.name.text);
    } else if (ts.isEnumDeclaration(stmt)) {
      push(stmt.name.text);
    }
  }

  return out;
}

/** Convert a PascalCase or camelCase export name into kebab-case. */
export function kebabExportName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/** Convert a PascalCase or camelCase export name into a human-readable title. */
export function humanizeExportName(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (spaced.length === 0) return name;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
