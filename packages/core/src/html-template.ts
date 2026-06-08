import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDotPath, protectHtmlComments, stringify } from './placeholder.js';

/**
 * Load an HTML file once and return a render function that substitutes
 * `{{ key }}` / `{{ key.dot.path }}` placeholders from a vars map.
 *
 * Designed for user directive handlers that want their output markup to
 * live in a real `.html` file instead of a JS template literal:
 *
 * ```ts
 * // directives/callout.ts
 * import { htmlTemplate, escapeAttribute, type DirectiveHandler } from '@doidor/markbook-core';
 *
 * const render = htmlTemplate(new URL('./callout.html', import.meta.url));
 *
 * export const callout: DirectiveHandler = ({ attributes, innerHtml }) => {
 *   const type = ['info', 'tip', 'warning', 'danger'].includes(attributes.type ?? '')
 *     ? attributes.type
 *     : 'info';
 *   return render({
 *     type: escapeAttribute(type!),
 *     content: innerHtml ?? '',
 *   });
 * };
 * ```
 *
 * ```html
 * <!-- directives/callout.html -->
 * <aside class="callout callout-{{ type }}" role="note">
 *   {{ content }}
 * </aside>
 * ```
 *
 * Behaviour:
 *
 * - **File loaded once.** The first `render()` call reads the file
 *   synchronously and caches it. Subsequent calls are pure string
 *   substitution. Cache is keyed by absolute path, so two `htmlTemplate`
 *   calls against the same file share one read.
 *
 * - **`source: URL` is the recommended form.** Pass
 *   `new URL('./template.html', import.meta.url)` so the path resolves
 *   relative to the calling module, not `process.cwd()`. Strings are
 *   accepted too (resolved as-is — absolute paths recommended).
 *
 * - **All substitutions are raw.** Values are inserted as-is, no
 *   HTML escaping. If you're interpolating untrusted input (frontmatter,
 *   attributes), call `escapeAttribute` / `escapeHtml` yourself before
 *   passing the vars in. Matches the way layout `{{ content }}` etc.
 *   work — Markbook's contract is "if you pass a string, it lands
 *   exactly as you wrote it."
 *
 * - **Missing keys render as empty string.** Strict typo-checking
 *   (like `applyHtmlLayout`) would require declaring the expected
 *   variable set, which adds API surface for marginal benefit at the
 *   per-directive level.
 *
 * - **`{{ }}` inside `<!-- ... -->` comments is preserved verbatim.**
 *   Same protection as `applyHtmlLayout` — lets you document expected
 *   vars in the template without tripping substitution.
 */
export function htmlTemplate(source: string | URL): (vars: Record<string, unknown>) => string {
  const filePath = source instanceof URL ? fileURLToPath(source) : source;
  let body: string | undefined;
  return (vars: Record<string, unknown>) => {
    if (body === undefined) {
      const cached = templateCache.get(filePath);
      if (cached !== undefined) {
        body = cached;
      } else {
        try {
          body = readFileSync(filePath, 'utf8');
        } catch (err) {
          throw new Error(
            `Markbook: htmlTemplate could not read '${filePath}': ${(err as Error).message}`,
          );
        }
        templateCache.set(filePath, body);
      }
    }
    return substituteHtmlTemplate(body, vars);
  };
}

const templateCache = new Map<string, string>();

function substituteHtmlTemplate(template: string, vars: Record<string, unknown>): string {
  // Protect HTML comments so `{{ key }}` mentions inside them don't get
  // substituted, then restore them verbatim afterwards.
  const { body: protectedBody, restore } = protectHtmlComments(template);
  const substituted = protectedBody.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    return stringify(getDotPath(vars, key));
  });
  return restore(substituted);
}
