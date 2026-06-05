/**
 * Shared `{{ key }}` placeholder plumbing used by the markdown-template
 * substitution (`template.ts` → `applyTemplate`), the HTML-layout
 * substitution (`template.ts` → `applyHtmlLayout`), and the directive
 * `htmlTemplate` helper (`html-template.ts`).
 *
 * Only the genuinely-shared bits live here — the value coercion, the
 * dot-path lookup, and the HTML-comment protection. The substitution loops
 * themselves stay in their modules because they differ (raw vs escaped vs
 * validated-against-a-known-token-set).
 */

/**
 * Coerce an arbitrary value to its placeholder string form: `null`/
 * `undefined` → `''`, strings pass through, numbers/booleans stringify,
 * everything else is JSON-encoded.
 */
export function stringify(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/** Resolve a dotted path (`a.b.c`) against a nested object; `undefined` on any miss. */
export function getDotPath(obj: unknown, dotPath: string): unknown {
  const parts = dotPath.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Replace every HTML comment with an opaque sentinel so a `{{ key }}`
 * mention inside a comment is neither substituted nor counted, then hand
 * back a `restore` that swaps the original comments back in. The sentinel
 * uses Unicode Private Use Area code points so it can never collide with
 * real HTML/JS/CSS the source might contain.
 */
export function protectHtmlComments(source: string): {
  body: string;
  restore: (s: string) => string;
} {
  const comments: string[] = [];
  const body = source.replace(/<!--[\s\S]*?-->/g, (match) => {
    const idx = comments.length;
    comments.push(match);
    return `\uE000MB_COMMENT_${idx}\uE000`;
  });
  const restore = (s: string): string =>
    s.replace(/\uE000MB_COMMENT_(\d+)\uE000/g, (_m, n: string) => comments[Number(n)] ?? '');
  return { body, restore };
}
