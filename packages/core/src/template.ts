/**
 * Apply a markdown template to page content, substituting `{{ key }}` tokens
 * from the page's frontmatter.
 *
 * Reserved tokens:
 *   - `{{ content }}` → the page's raw markdown body
 *   - `{{ frontmatter.x.y }}` → arbitrary frontmatter field via dot path
 *   - `{{ <key> }}` → `frontmatter[key]` (top-level)
 *
 * Missing keys substitute as the empty string. The substituted result is
 * parsed as markdown by the rest of the pipeline, so directives in the
 * template (`:::props`, etc.) resolve against the page's frontmatter.
 */
export function applyTemplate(
  content: string,
  frontmatter: Record<string, unknown>,
  templateBody: string,
): string {
  return templateBody.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    if (key === 'content') return content;
    if (key.startsWith('frontmatter.')) {
      return stringify(getDotPath(frontmatter, key.slice('frontmatter.'.length)));
    }
    return stringify(frontmatter[key]);
  });
}

function getDotPath(obj: unknown, dotPath: string): unknown {
  const parts = dotPath.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function stringify(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}
