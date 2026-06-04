/**
 * Tiny escaping helpers exposed so user directive handlers don't have to
 * import them from somewhere else. Both are safe defaults for raw HTML
 * generated from untrusted input (e.g. directive attributes or page
 * frontmatter):
 *
 *   ```ts
 *   directives: {
 *     youtube: ({ attributes }) =>
 *       `<iframe src="https://youtube.com/embed/${escapeAttribute(attributes.id ?? '')}" />`,
 *   }
 *   ```
 *
 * Both functions are intentionally simple — they escape the five
 * characters required to make text safe inside HTML element content AND
 * inside double-quoted attribute values. For interpolation into URLs,
 * validate / pattern-match the value separately (escaping isn't the same
 * as URL-safe).
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** HTML-escape a string for safe inclusion as element text. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/**
 * HTML-escape a string for safe inclusion inside a double-quoted
 * attribute value. Implementation-equivalent to `escapeHtml` today, but
 * named separately so handler authors reach for the right tool — and so
 * future versions can diverge if attribute escaping ever needs more
 * (e.g. percent-encoding for `href`).
 */
export function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
