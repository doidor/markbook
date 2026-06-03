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

/**
 * HTML layout placeholders that carry pre-rendered HTML fragments from
 * Markbook. These are substituted as-is (NOT escaped) — they are trusted
 * Markbook-generated markup.
 */
export const HTML_LAYOUT_RAW_TOKENS = [
  'content',
  'head',
  'bodyEnd',
  'pageActions',
  'search',
  'themeToggle',
] as const;

/**
 * HTML layout placeholders that carry user-supplied text (titles,
 * descriptions, frontmatter values). These are HTML-escaped before
 * substitution to prevent accidental HTML injection from frontmatter.
 */
export const HTML_LAYOUT_TEXT_TOKENS = [
  'title',
  'description',
  'siteTitle',
  'browserTitle',
] as const;

export type HtmlLayoutRawToken = (typeof HTML_LAYOUT_RAW_TOKENS)[number];
export type HtmlLayoutTextToken = (typeof HTML_LAYOUT_TEXT_TOKENS)[number];

export interface HtmlLayoutSubstitutions {
  raw: Record<HtmlLayoutRawToken, string>;
  text: Record<HtmlLayoutTextToken, string>;
}

/**
 * Apply an HTML layout to a page's rendered body. The layout is HTML with
 * `{{ key }}` tokens substituted from:
 *   - The fixed Markbook placeholder set (see `HTML_LAYOUT_RAW_TOKENS` and
 *     `HTML_LAYOUT_TEXT_TOKENS`) — raw tokens pass through verbatim, text
 *     tokens are HTML-escaped.
 *   - `frontmatter.<key>` paths — values are HTML-escaped via `stringify`.
 *
 * `{{ key }}` tokens inside HTML comments (`<!-- ... -->`) are NOT
 * substituted and are preserved verbatim. This lets layout files document
 * their own placeholder vocabulary in comments without tripping
 * validation (the comments themselves stay in the output).
 *
 * Validation (throws on any of these):
 *   - The layout must contain exactly one `{{ content }}` placeholder
 *     (counted outside comments). Zero or more than one is an error.
 *   - Any `{{ key }}` token outside the known set (and not starting with
 *     `frontmatter.`) is an error — protects against typos like
 *     `{{ titlte }}` silently rendering empty.
 *
 * Returns the substituted HTML string. The caller is responsible for any
 * post-processing (e.g. `transformHtml`).
 */
export function applyHtmlLayout(
  layoutBody: string,
  subs: HtmlLayoutSubstitutions,
  frontmatter: Record<string, unknown>,
  layoutName: string,
): string {
  // Temporarily replace HTML comments with opaque sentinels so the
  // placeholder regex doesn't see (or count) tokens inside them. Restore
  // afterwards so the comments make it to the output unchanged. We use
  // Unicode Private Use Area code points so the sentinel never collides
  // with real HTML, JS, or CSS the layout might contain.
  const comments: string[] = [];
  const protectedBody = layoutBody.replace(/<!--[\s\S]*?-->/g, (match) => {
    const idx = comments.length;
    comments.push(match);
    return `\uE000MB_HTML_COMMENT_${idx}\uE000`;
  });
  const restore = (s: string): string =>
    s.replace(/\uE000MB_HTML_COMMENT_(\d+)\uE000/g, (_m, n: string) => comments[Number(n)] ?? '');

  const contentMatches = protectedBody.match(/\{\{\s*content\s*\}\}/g);
  if (!contentMatches || contentMatches.length === 0) {
    throw new Error(
      `Markbook: HTML layout '${layoutName}' is missing a {{ content }} placeholder. ` +
        `Add {{ content }} where the page body should render.`,
    );
  }
  if (contentMatches.length > 1) {
    throw new Error(
      `Markbook: HTML layout '${layoutName}' has ${contentMatches.length} {{ content }} placeholders. ` +
        `Exactly one is allowed (duplicate IDs and story mount nodes would break the page).`,
    );
  }

  const known = new Set<string>([...HTML_LAYOUT_RAW_TOKENS, ...HTML_LAYOUT_TEXT_TOKENS]);
  const rawTokens = new Set<string>(HTML_LAYOUT_RAW_TOKENS);
  const textTokens = new Set<string>(HTML_LAYOUT_TEXT_TOKENS);

  const substituted = protectedBody.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    if (rawTokens.has(key)) return subs.raw[key as HtmlLayoutRawToken];
    if (textTokens.has(key)) return escapeHtml(subs.text[key as HtmlLayoutTextToken]);
    if (key.startsWith('frontmatter.')) {
      return escapeHtml(stringify(getDotPath(frontmatter, key.slice('frontmatter.'.length))));
    }
    throw new Error(
      `Markbook: HTML layout '${layoutName}' uses unknown placeholder {{ ${key} }}. ` +
        `Known tokens: ${[...known].sort().join(', ')}, frontmatter.<key>.`,
    );
  });

  return restore(substituted);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
