import { describe, it, expect } from 'vitest';
import { parseMarkdown } from './parse.js';

describe('parseMarkdown', () => {
  it('parses a simple page with frontmatter and title', async () => {
    const source = `---
title: My Page
description: A simple test page.
---

# Hello

Some body.`;
    const result = await parseMarkdown(source, 'my-page', {
      pageFile: '/tmp/my-page.md',
    });
    expect(result.title).toBe('My Page');
    expect(result.frontmatter.description).toBe('A simple test page.');
    expect(result.stories).toHaveLength(0);
  });

  it('extracts story directives with src and export', async () => {
    const source = `# Test

:::story{src=./Foo.stories.tsx export=Default}
:::`;
    const result = await parseMarkdown(source, 'test', {
      pageFile: '/tmp/test.md',
    });
    expect(result.stories).toHaveLength(1);
    expect(result.stories[0]).toMatchObject({
      src: './Foo.stories.tsx',
      exportName: 'Default',
      slug: undefined,
    });
  });

  it('reads `id=` attribute as slug override', async () => {
    const source = `# Test

:::story{src=./Foo.stories.tsx id=stable-foo}
:::`;
    const result = await parseMarkdown(source, 'test', {
      pageFile: '/tmp/test.md',
    });
    expect(result.stories[0]?.slug).toBe('stable-foo');
  });

  it('defaults exportName to "default" when no export attribute', async () => {
    const source = `:::story{src=./Foo.stories.tsx}
:::`;
    const result = await parseMarkdown(source, 'test', {
      pageFile: '/tmp/test.md',
    });
    expect(result.stories[0]?.exportName).toBe('default');
  });

  it('skips story directive when src is missing', async () => {
    const source = `:::story{}
:::`;
    const result = await parseMarkdown(source, 'test', {
      pageFile: '/tmp/test.md',
    });
    expect(result.stories).toHaveLength(0);
  });

  it('collects H2 and H3 headings with rehype-slug ids', async () => {
    const source = `# Title

## First Section

Body.

### Sub Section

More body.`;
    const result = await parseMarkdown(source, 'test', {
      pageFile: '/tmp/test.md',
    });
    const h2 = result.headings.find((h) => h.level === 2);
    const h3 = result.headings.find((h) => h.level === 3);
    expect(h2?.text).toBe('First Section');
    expect(h2?.slug).toBe('first-section');
    expect(h3?.slug).toBe('sub-section');
  });

  it('applies template when frontmatter.template + loadTemplate are set', async () => {
    const source = `---
title: Wrapped
template: layout
---

Body content.`;
    const loadTemplate = async (name: string) => {
      if (name === 'layout') {
        return '# {{ title }}\n\nBefore. {{ content }} After.';
      }
      throw new Error('not found');
    };
    const result = await parseMarkdown(source, 'wrapped', {
      pageFile: '/tmp/w.md',
      loadTemplate,
    });
    expect(result.title).toBe('Wrapped');
    expect(result.html).toContain('Wrapped');
    expect(result.html).toContain('Before.');
    expect(result.html).toContain('After.');
    expect(result.html).toContain('Body content.');
  });

  it('plainMarkdown strips story directives but keeps surrounding prose', async () => {
    const source = `# Title

Some body.

:::story{src=./Foo.stories.tsx}
:::

After.`;
    const result = await parseMarkdown(source, 'test', {
      pageFile: '/tmp/t.md',
    });
    expect(result.plainMarkdown).not.toContain(':::story');
    expect(result.plainMarkdown).toContain('Some body.');
    expect(result.plainMarkdown).toContain('After.');
  });

  it('renders props directive as a placeholder when no resolver is provided', async () => {
    const source = `---
component: ./Foo.tsx
---

:::props
:::`;
    const result = await parseMarkdown(source, 'test', {
      pageFile: '/tmp/t.md',
    });
    expect(result.html).toContain('markbook props table');
  });

  it('falls back to first H1 for title when frontmatter has none', async () => {
    const source = `# Inferred title\n\nBody.`;
    const result = await parseMarkdown(source, 'test', {
      pageFile: '/tmp/t.md',
    });
    expect(result.title).toBe('Inferred title');
  });
});
