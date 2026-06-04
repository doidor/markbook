import { escapeAttribute, htmlTemplate, type DirectiveHandler } from '@markbook/core';

/**
 * `:::callout{type=info|tip|warning|danger}` user directive.
 *
 * Demonstrates two patterns the docs recommend:
 *
 *   1. **Handler lives in its own file.** Just an exported function;
 *      jiti loads the whole config tree, so TS imports work
 *      transitively.
 *
 *   2. **Output HTML lives in `callout.html`** loaded by `htmlTemplate`.
 *      The handler maps validated attribute values to the template's
 *      `{{ }}` placeholders. Keeps the markup out of JS template
 *      literals so designers can edit the structure without touching
 *      handler logic.
 */

const CALLOUT_TYPES = new Set(['info', 'tip', 'warning', 'danger']);

// Load the .html template once at module init (cached, sync — no
// per-render I/O cost). `new URL('./callout.html', import.meta.url)`
// resolves relative to THIS file regardless of where the user's
// markbook.config.ts lives.
const render = htmlTemplate(new URL('./callout.html', import.meta.url));

export const callout: DirectiveHandler = ({ attributes, innerHtml }) => {
  const raw = attributes.type ?? 'info';
  const type = CALLOUT_TYPES.has(raw) ? raw : 'info';
  return render({
    type: escapeAttribute(type),
    content: innerHtml ?? '',
  });
};
