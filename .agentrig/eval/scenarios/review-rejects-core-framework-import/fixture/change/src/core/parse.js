// Pure markdown parser. Framework-agnostic — must not import from react / vue / etc.
// See ../../RULES.md §1.

import { createElement } from 'react';

const HEADING_RE = /^(#{1,6})\s+(.+)$/;

export function parseMarkdown(input) {
  const lines = input.split('\n');
  const nodes = [];
  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m) {
      nodes.push({ type: 'heading', level: m[1].length, text: m[2] });
    } else if (line.trim()) {
      nodes.push({ type: 'paragraph', text: line });
    }
  }
  const tree = createElement('div', null, JSON.stringify(nodes));
  return { type: 'root', children: nodes, tree };
}
