import { visit } from 'unist-util-visit';
import { copyButton, highlightCode } from './code-block.js';
import { escapeHtml } from './directive-utils.js';

/**
 * Rehype tree transformer: walk every `<pre><code>` pair (with or without a
 * `language-X` class) and wrap it with `<div class="markbook-code-pre-wrap
 * markbook-fenced-code">` + a hover-revealed copy button. Code blocks that
 * declare a language are also Shiki-highlighted using the same dual-theme
 * config as the story code disclosures (`themes: { light: 'github-light',
 * dark: 'github-dark' }`, `defaultColor: false`) so the `[data-theme]` CSS
 * swap that styles story code blocks also styles fenced markdown code.
 *
 * The wrapper carries the `markbook-fenced-code` marker class so its
 * visual treatment (border, radius, padding, background) scopes cleanly
 * and never touches the story-disclosure variant of `.markbook-code-pre-wrap`.
 *
 * The reused `[data-markbook-copy]` boot script (in `build.ts`) finds the
 * closest `.markbook-code-pre-wrap` from the button and copies the inner
 * `<pre>`'s `textContent` — no per-fenced-block wiring needed here.
 *
 * `data-pagefind-ignore="all"` on the copy button keeps the literal "Copy"
 * glyph out of both the Pagefind index AND search-result excerpts.
 */
export async function highlightFencedCodeBlocks(tree: unknown): Promise<void> {
  interface Target {
    parent: { children: unknown[] };
    index: number;
    lang: string | null;
    code: string;
  }
  const targets: Target[] = [];

  visit(tree as never, 'element', (node: any, index: number | undefined, parent: any) => {
    if (node?.tagName !== 'pre') return;
    if (!Array.isArray(node.children) || node.children.length !== 1) return;
    const only = node.children[0];
    if (!only || only.type !== 'element' || only.tagName !== 'code') return;
    if (index === undefined || !parent || !Array.isArray(parent.children)) return;

    const className = only.properties?.className;
    const langCls = Array.isArray(className)
      ? className.find((c: unknown) => typeof c === 'string' && c.startsWith('language-'))
      : undefined;
    const lang = typeof langCls === 'string' ? langCls.slice('language-'.length) : null;
    const code = textContent(only).replace(/\n$/, '');

    targets.push({ parent, index, lang, code });
  });

  // Process in reverse document order so an earlier splice can't shift
  // the index of a later target inside the same parent.
  targets.sort((a, b) => (a.parent === b.parent ? b.index - a.index : 0));
  for (const t of targets) {
    const html = await renderBlock(t.code, t.lang);
    t.parent.children.splice(t.index, 1, { type: 'raw', value: html } as never);
  }
}

async function renderBlock(code: string, lang: string | null): Promise<string> {
  let inner: string;
  if (lang) {
    try {
      inner = await highlightCode(code, lang);
    } catch {
      inner = `<pre><code>${escapeHtml(code)}</code></pre>`;
    }
  } else {
    inner = `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
  return `<div class="markbook-code-pre-wrap markbook-fenced-code">${copyButton(true)}${inner}</div>`;
}

function textContent(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return typeof node.value === 'string' ? node.value : '';
  if (!Array.isArray(node.children)) return '';
  return node.children.map(textContent).join('');
}
