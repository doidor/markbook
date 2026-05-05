import fs from 'node:fs/promises';
import ts from 'typescript';
import { codeToHtml } from 'shiki';

const sourceCache = new Map<string, string>();

export async function extractStoryCode(
  absStoryFile: string,
  exportName: string,
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

  const sourceFile = ts.createSourceFile(
    absStoryFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    absStoryFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  for (const stmt of sourceFile.statements) {
    if (!hasExportModifier(stmt)) continue;

    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === exportName) {
          return buildResult(source, stmt.getStart(sourceFile), stmt.getEnd());
        }
      }
    } else if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === exportName) {
      return buildResult(source, stmt.getStart(sourceFile), stmt.getEnd());
    }
  }

  return null;
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const mods = ts.getModifiers(node);
  return mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

async function buildResult(
  source: string,
  start: number,
  end: number,
): Promise<{ code: string; codeHtml: string }> {
  const code = source.slice(start, end).trim();
  const codeHtml = await codeToHtml(code, { lang: 'tsx', theme: 'github-light' });
  return { code, codeHtml };
}
