import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { highlightFencedCodeBlocks } from './fenced-code.js';

async function render(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(() => async (tree: unknown) => {
      await highlightFencedCodeBlocks(tree);
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(file);
}

describe('highlightFencedCodeBlocks', () => {
  it('wraps a TS code block with the fenced-code wrapper + copy button', async () => {
    const html = await render(['```ts', 'const x: number = 1;', '```'].join('\n'));
    expect(html).toContain('class="markbook-code-pre-wrap markbook-fenced-code"');
    expect(html).toContain('data-markbook-copy');
    expect(html).toContain('data-pagefind-ignore="all"');
  });

  it('runs Shiki on languaged blocks (dual-theme CSS vars present)', async () => {
    const html = await render(['```ts', "const greeting = 'hi';", '```'].join('\n'));
    expect(html).toContain('class="shiki shiki-themes');
    expect(html).toMatch(/--shiki-light:#[0-9A-F]/i);
    expect(html).toMatch(/--shiki-dark:#[0-9A-F]/i);
  });

  it('still wraps + copy-buttons a code block with NO language tag (no Shiki)', async () => {
    const html = await render(['```', 'plain text', '```'].join('\n'));
    expect(html).toContain('markbook-fenced-code');
    expect(html).toContain('data-markbook-copy');
    expect(html).not.toContain('class="shiki');
  });

  it('falls back to plain <pre><code> on unknown language (Shiki throws)', async () => {
    const html = await render(['```not-a-real-language-xyz', 'whatever', '```'].join('\n'));
    expect(html).toContain('markbook-fenced-code');
    expect(html).toContain('data-markbook-copy');
    expect(html).toContain('<pre><code>whatever</code></pre>');
  });

  it('HTML-escapes the unhighlighted fallback content', async () => {
    const html = await render(['```', '<script>alert(1)</script>', '```'].join('\n'));
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('does NOT touch inline `code` spans', async () => {
    const html = await render('A paragraph with `inline code` in it.');
    expect(html).toContain('<code>inline code</code>');
    expect(html).not.toContain('markbook-fenced-code');
    expect(html).not.toContain('data-markbook-copy');
  });

  it('wraps multiple sibling code blocks correctly (reverse-splice safety)', async () => {
    // Use no-language blocks so the contents survive Shiki tokenization
    // intact and indexOf checks remain readable.
    const md = ['```', 'ALPHA', '```', '', '```', 'BETA', '```', '', '```', 'GAMMA', '```'].join(
      '\n',
    );
    const html = await render(md);
    const wrappers = html.match(/markbook-fenced-code/g) ?? [];
    expect(wrappers.length).toBe(3);
    expect(html.indexOf('ALPHA')).toBeGreaterThan(-1);
    expect(html.indexOf('ALPHA')).toBeLessThan(html.indexOf('BETA'));
    expect(html.indexOf('BETA')).toBeLessThan(html.indexOf('GAMMA'));
  });

  it('uses dual-theme Shiki config (defaultColor: false → CSS vars not inline colors)', async () => {
    const html = await render(['```ts', 'true', '```'].join('\n'));
    // defaultColor:false output has the CSS-var-of-var pattern, not bare colors
    expect(html).toMatch(/--shiki-light:/);
    expect(html).not.toMatch(/style="color:\s*#[0-9A-F]{3,6};\s*background-color/i);
  });
});
