import { escapeAttribute, type DirectiveHandler } from '@markbook/core';

/**
 * `:::callout{type=info|tip|warning|danger}` user directive.
 *
 * Renders an `<aside class="callout callout-<type>">` wrapping the inner
 * markdown (which Markbook has already rendered to HTML by the time we
 * see it). Falls back to `info` for unknown types so a typo doesn't
 * silently render an unstyled box.
 *
 * Lives in its own file (instead of inline in markbook.config.ts) to
 * demonstrate the pattern: directive handlers are just regular modules
 * — import them where you need them. jiti handles the TS loading
 * because the surrounding config file is already a TS module.
 */

const CALLOUT_TYPES = new Set(['info', 'tip', 'warning', 'danger']);

export const callout: DirectiveHandler = ({ attributes, innerHtml }) => {
  const raw = attributes.type ?? 'info';
  const type = CALLOUT_TYPES.has(raw) ? raw : 'info';
  return `<aside class="callout callout-${escapeAttribute(type)}" role="note">${innerHtml ?? ''}</aside>`;
};
