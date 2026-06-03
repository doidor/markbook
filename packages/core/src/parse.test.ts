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

  describe('bare-specifier resolution (frontmatter.component)', () => {
    it('resolves `component:` from a bare specifier via Node module resolution', async () => {
      const path = await import('node:path');
      const os = await import('node:os');
      const fs = await import('node:fs/promises');
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-bare-'));
      try {
        // Stand up a tiny node_modules tree with @my-org/button
        await fs.mkdir(path.join(root, 'node_modules/@my-org/button'), { recursive: true });
        await fs.writeFile(
          path.join(root, 'node_modules/@my-org/button/package.json'),
          JSON.stringify({ name: '@my-org/button', main: './index.tsx' }),
        );
        await fs.writeFile(
          path.join(root, 'node_modules/@my-org/button/index.tsx'),
          `import * as React from 'react';
export interface ButtonProps {
  /** Visual variant. */
  variant?: 'primary' | 'secondary';
}
export const Button = (_props: ButtonProps) => null;`,
        );
        await fs.writeFile(path.join(root, 'package.json'), '{}');

        const pageFile = path.join(root, 'docs', 'index.md');
        await fs.mkdir(path.dirname(pageFile), { recursive: true });

        // We verify the COMPONENT path resolution surfaces the right absolute
        // file to the resolveProps callback — not that react-docgen-typescript
        // actually generates a table (that's covered by props.test.ts).
        const observed: { absComponentFile: string }[] = [];
        const source = `---
title: Bare
component: '@my-org/button'
---

:::props
:::`;
        await parseMarkdown(source, 'bare', {
          pageFile,
          resolveProps: async (info) => {
            observed.push(info);
            return { tableHtml: '<table>ok</table>', tableMarkdown: '| ok |' };
          },
        });

        expect(observed).toHaveLength(1);
        const realRoot = await fs.realpath(root);
        expect(observed[0]!.absComponentFile).toBe(
          path.join(realRoot, 'node_modules/@my-org/button/index.tsx'),
        );
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('relative `component:` paths still resolve as before', async () => {
      const path = await import('node:path');
      const observed: { absComponentFile: string }[] = [];
      await parseMarkdown(
        `---
component: ../src/Button.tsx
---

:::props
:::`,
        'rel',
        {
          pageFile: '/tmp/docs/page.md',
          resolveProps: async (info) => {
            observed.push(info);
            return { tableHtml: '<table>ok</table>', tableMarkdown: '| ok |' };
          },
        },
      );
      expect(observed[0]!.absComponentFile).toBe(path.resolve('/tmp/src/Button.tsx'));
    });
  });

  describe(':::stories directive', () => {
    const exportsByFile = new Map<string, string[]>([
      ['/tmp/Foo.stories.tsx', ['Primary', 'Secondary', 'Tertiary']],
      ['/tmp/Empty.stories.tsx', []],
    ]);
    const resolveStoryExports = async (absStoryFile: string) =>
      exportsByFile.get(absStoryFile) ?? null;

    it('fans out one StoryRef per discovered export', async () => {
      const source = `:::stories{src=./Foo.stories.tsx}
:::`;
      const result = await parseMarkdown(source, 'page', {
        pageFile: '/tmp/p.md',
        resolveStoryExports,
      });
      expect(result.stories.map((s) => s.exportName)).toEqual(['Primary', 'Secondary', 'Tertiary']);
      // Every fan-out story carries a groupId pointing at the shared group.
      const groupIds = new Set(result.stories.map((s) => s.groupId));
      expect(groupIds.size).toBe(1);
      expect([...groupIds][0]).toMatch(/--g0$/);
    });

    it('applies only= whitelist', async () => {
      const source = `:::stories{src=./Foo.stories.tsx only=Primary,Tertiary}
:::`;
      const result = await parseMarkdown(source, 'page', {
        pageFile: '/tmp/p.md',
        resolveStoryExports,
      });
      expect(result.stories.map((s) => s.exportName)).toEqual(['Primary', 'Tertiary']);
    });

    it('applies exclude= blacklist', async () => {
      const source = `:::stories{src=./Foo.stories.tsx exclude=Secondary}
:::`;
      const result = await parseMarkdown(source, 'page', {
        pageFile: '/tmp/p.md',
        resolveStoryExports,
      });
      expect(result.stories.map((s) => s.exportName)).toEqual(['Primary', 'Tertiary']);
    });

    it('throws when only= references an unknown export', async () => {
      const source = `:::stories{src=./Foo.stories.tsx only=Primary,Missing}
:::`;
      await expect(
        parseMarkdown(source, 'page', {
          pageFile: '/tmp/p.md',
          resolveStoryExports,
        }),
      ).rejects.toThrow(/'Missing' is not an export of/);
    });

    it('throws when filtering leaves zero exports', async () => {
      const source = `:::stories{src=./Foo.stories.tsx exclude=Primary,Secondary,Tertiary}
:::`;
      await expect(
        parseMarkdown(source, 'page', {
          pageFile: '/tmp/p.md',
          resolveStoryExports,
        }),
      ).rejects.toThrow(/zero exports/);
    });

    it('throws when the resolver returns null (missing file)', async () => {
      const source = `:::stories{src=./Missing.stories.tsx}
:::`;
      await expect(
        parseMarkdown(source, 'page', {
          pageFile: '/tmp/p.md',
          resolveStoryExports,
        }),
      ).rejects.toThrow(/could not be read/);
    });

    it('throws when no resolver is provided', async () => {
      const source = `:::stories{src=./Foo.stories.tsx}
:::`;
      await expect(
        parseMarkdown(source, 'page', {
          pageFile: '/tmp/p.md',
        }),
      ).rejects.toThrow(/no `resolveStoryExports` callback/);
    });

    it('inserts an H3 heading per story so they appear in TOC', async () => {
      const source = `:::stories{src=./Foo.stories.tsx}
:::`;
      const result = await parseMarkdown(source, 'page', {
        pageFile: '/tmp/p.md',
        resolveStoryExports,
      });
      const h3s = result.headings.filter((h) => h.level === 3).map((h) => h.text);
      expect(h3s).toEqual(['Primary', 'Secondary', 'Tertiary']);
    });

    it('humanizes export names in the inserted headings', async () => {
      const exports = new Map([['/tmp/F.stories.tsx', ['PrimaryButton', 'FullWidthVariant']]]);
      const source = `:::stories{src=./F.stories.tsx}
:::`;
      const result = await parseMarkdown(source, 'page', {
        pageFile: '/tmp/p.md',
        resolveStoryExports: async (f) => exports.get(f) ?? null,
      });
      expect(result.headings.filter((h) => h.level === 3).map((h) => h.text)).toEqual([
        'Primary Button',
        'Full Width Variant',
      ]);
    });
  });
});
