import ts from 'typescript';

/**
 * Shared TypeScript compiler-API helpers. These back the AST work in
 * `code.ts`, `exports.ts`, and `inline-sources.ts` (the repo prefers the TS
 * compiler API over regex for anything semantic). Stateless — every call
 * re-parses, so there is no cache to invalidate.
 */

/** Pick the TS `ScriptKind` for a file from its extension. */
export function pickScriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (fileName.endsWith('.js')) return ts.ScriptKind.JS;
  if (fileName.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.Unknown;
}

/** True when a node carries the `export` modifier keyword. */
export function hasExportModifier(node: ts.Node): boolean {
  const mods = (node as ts.HasModifiers).modifiers;
  if (!mods) return false;
  return mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/**
 * Extract the static module specifiers from a source file's top-level
 * `import` declarations — and, when `includeExports` is set, re-export
 * `export ... from '...'` declarations too.
 *
 * Side-effect imports (`import './x.css'`) ARE included. Dynamic
 * `import('x')` is NOT (it's a call expression, not a declaration). Using
 * the compiler API instead of a regex avoids matching `import`/`export`
 * tokens that appear inside comments or string literals.
 */
export function extractModuleSpecifiers(
  source: string,
  fileName: string,
  opts: { includeExports?: boolean } = {},
): string[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    false,
    pickScriptKind(fileName),
  );
  const specs: string[] = [];
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt)) {
      if (ts.isStringLiteral(stmt.moduleSpecifier)) specs.push(stmt.moduleSpecifier.text);
    } else if (opts.includeExports && ts.isExportDeclaration(stmt)) {
      if (stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
        specs.push(stmt.moduleSpecifier.text);
      }
    }
  }
  return specs;
}
