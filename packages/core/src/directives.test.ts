import { describe, it, expect } from 'vitest';
import { parseMarkdown } from './parse.js';
import { escapeHtml, escapeAttribute } from './directive-utils.js';
import type { DirectiveHandler } from './config.js';

/**
 * Tests for the user-directive extension system.
 *
 * Most assertions read the rendered HTML; a few read `plainMarkdown` to
 * verify the llms.txt mirror behaviour and `directiveDependencies` to
 * verify dev-mode dependency reporting.
 */

function call(
  source: string,
  directives: Record<string, DirectiveHandler>,
  extra: Partial<Parameters<typeof parseMarkdown>[2]> = {},
) {
  return parseMarkdown(source, 'test', {
    pageFile: '/tmp/test/page.md',
    userDirectives: directives,
    root: '/tmp/test',
    ...extra,
  });
}

describe('user directives — leaf form (::name{...})', () => {
  it('substitutes the handler output for the directive', async () => {
    const result = await call('::badge{label=stable}', {
      badge: ({ attributes }) => `<span class="badge">${attributes.label}</span>`,
    });
    expect(result.html).toContain('<span class="badge">stable</span>');
  });

  it('passes attributes as Record<string, string | undefined>', async () => {
    let captured: Record<string, string | undefined> | null = null;
    await call('::probe{foo=bar empty}', {
      probe: ({ attributes }) => {
        captured = attributes;
        return '';
      },
    });
    expect(captured).toBeTruthy();
    expect(captured!.foo).toBe('bar');
    // remark-directive emits valueless attrs as empty string — surfaced via the union type.
    expect(captured!.empty).toBe('');
  });

  it('passes type=leaf in the context for leaf directives', async () => {
    let capturedType: string | null = null;
    await call('::probe{}', {
      probe: ({ type }) => {
        capturedType = type;
        return '';
      },
    });
    expect(capturedType).toBe('leaf');
  });

  it('innerHtml and innerMarkdown are null for leaf directives', async () => {
    let inner: { html: string | null; md: string | null } | null = null;
    await call('::probe{}', {
      probe: ({ innerHtml, innerMarkdown }) => {
        inner = { html: innerHtml, md: innerMarkdown };
        return '';
      },
    });
    expect(inner).toEqual({ html: null, md: null });
  });
});

describe('user directives — container form (:::name\\n...\\n:::)', () => {
  it('renders inner markdown to HTML and passes it as innerHtml', async () => {
    let capturedHtml: string | null = null;
    await call(
      `:::callout{type=warning}
This is **bold** text.
:::`,
      {
        callout: ({ innerHtml }) => {
          capturedHtml = innerHtml;
          return `<div class="callout">${innerHtml ?? ''}</div>`;
        },
      },
    );
    expect(capturedHtml).toContain('<p>This is <strong>bold</strong> text.</p>');
  });

  it('passes raw markdown source as innerMarkdown', async () => {
    let capturedMd: string | null = null;
    await call(
      `:::callout{type=info}
- one
- two

Paragraph with [link](https://example.com).
:::`,
      {
        callout: ({ innerMarkdown }) => {
          capturedMd = innerMarkdown;
          return '';
        },
      },
    );
    expect(capturedMd).toContain('- one');
    expect(capturedMd).toContain('Paragraph with [link]');
  });

  it('substitutes the handler output (with rendered inner HTML wrapped)', async () => {
    const result = await call(
      `:::callout{type=warning}
**Heads up!** This may break things.
:::`,
      {
        callout: ({ attributes, innerHtml }) =>
          `<aside class="callout callout-${attributes.type}">${innerHtml ?? ''}</aside>`,
      },
    );
    expect(result.html).toContain('<aside class="callout callout-warning">');
    expect(result.html).toContain('<strong>Heads up!</strong>');
  });

  it('passes type=container in the context for container directives', async () => {
    let capturedType: string | null = null;
    await call(
      `:::probe
body
:::`,
      {
        probe: ({ type }) => {
          capturedType = type;
          return '';
        },
      },
    );
    expect(capturedType).toBe('container');
  });
});

describe('user directives — handler descriptor with pinned type', () => {
  it('throws when a leaf-pinned handler is used as a container', async () => {
    await expect(
      call(
        `:::callout
body
:::`,
        {
          callout: {
            type: 'leaf',
            handler: () => '<div></div>',
          },
        },
      ),
    ).rejects.toThrow(/written as container .* but the handler is pinned to leaf/);
  });

  it('throws when a container-pinned handler is used as a leaf', async () => {
    await expect(
      call('::callout{}', {
        callout: {
          type: 'container',
          handler: () => '<div></div>',
        },
      }),
    ).rejects.toThrow(/written as leaf .* but the handler is pinned to container/);
  });

  it('function shorthand accepts both forms (no pinning)', async () => {
    const handler = ({ type }: { type: string }) => `<x data-form="${type}"></x>`;
    const leaf = await call('::flexible{}', { flexible: handler });
    expect(leaf.html).toContain('<x data-form="leaf"></x>');
    const container = await call(
      `:::flexible
body
:::`,
      { flexible: handler },
    );
    expect(container.html).toContain('<x data-form="container"></x>');
  });
});

describe('user directives — async handlers', () => {
  it('awaits async handler return values', async () => {
    const result = await call('::async{}', {
      async: async () => {
        await new Promise((r) => setTimeout(r, 10));
        return '<span>async-result</span>';
      },
    });
    expect(result.html).toContain('<span>async-result</span>');
  });

  it('runs multiple handlers in parallel', async () => {
    const timings: number[] = [];
    const handler = async ({ name }: { name: string }) => {
      timings.push(Date.now());
      await new Promise((r) => setTimeout(r, 50));
      return `<x>${name}</x>`;
    };
    const start = Date.now();
    const result = await call(
      `::a{}
::b{}
::c{}`,
      { a: handler, b: handler, c: handler },
    );
    const elapsed = Date.now() - start;
    expect(result.html).toContain('<x>a</x>');
    expect(result.html).toContain('<x>b</x>');
    expect(result.html).toContain('<x>c</x>');
    // Parallel execution: should be well under 3*50 = 150ms.
    expect(elapsed).toBeLessThan(130);
    expect(timings.length).toBe(3);
  });
});

describe('user directives — DirectiveResultObject', () => {
  it('returns html + markdown fallback for llms.txt mirror', async () => {
    const result = await call(`::tweet{id=12345}`, {
      tweet: ({ attributes }) => ({
        html: `<blockquote class="twitter-tweet">...${attributes.id}...</blockquote>`,
        markdown: `(embedded tweet ${attributes.id})`,
      }),
    });
    expect(result.html).toContain('twitter-tweet');
    expect(result.plainMarkdown).toContain('(embedded tweet 12345)');
    expect(result.plainMarkdown).not.toContain('::tweet');
  });

  it('reports dependencies for dev-mode re-rendering', async () => {
    const result = await call('::data{src=./users.json}', {
      data: ({ attributes }) => ({
        html: `<pre>${attributes.src}</pre>`,
        dependencies: ['/abs/path/to/users.json', '/abs/path/to/schema.json'],
      }),
    });
    expect(result.directiveDependencies).toEqual([
      '/abs/path/to/users.json',
      '/abs/path/to/schema.json',
    ]);
  });

  it('dedupes dependencies across multiple directives in one page', async () => {
    const result = await call(
      `::a{}
::b{}`,
      {
        a: () => ({ html: '', dependencies: ['/shared.json', '/a.json'] }),
        b: () => ({ html: '', dependencies: ['/shared.json', '/b.json'] }),
      },
    );
    expect(result.directiveDependencies.sort()).toEqual(['/a.json', '/b.json', '/shared.json']);
  });

  it('null/undefined return drops the directive', async () => {
    const result = await call(
      `Before
::nothing{}
After`,
      {
        nothing: () => null,
      },
    );
    expect(result.html).not.toContain('::nothing');
    expect(result.html).toContain('Before');
    expect(result.html).toContain('After');
  });
});

describe('user directives — context fields', () => {
  it('passes pageFile, root, frontmatter, and name', async () => {
    let ctx: Record<string, unknown> | null = null;
    await parseMarkdown('---\nauthor: Tudor\n---\n\n::probe{x=y}', 'fid', {
      pageFile: '/tmp/site/pages/intro.md',
      root: '/tmp/site',
      userDirectives: {
        probe: (c) => {
          ctx = { ...c, attributes: undefined };
          return '';
        },
      },
    });
    expect(ctx).toMatchObject({
      name: 'probe',
      type: 'leaf',
      pageFile: '/tmp/site/pages/intro.md',
      root: '/tmp/site',
      frontmatter: { author: 'Tudor' },
    });
  });
});

describe('user directives — error handling', () => {
  it('wraps thrown errors with file:line context and preserves the cause', async () => {
    try {
      await call(
        `# Title

::boom{}`,
        {
          boom: () => {
            throw new Error('original failure');
          },
        },
      );
      throw new Error('expected throw');
    } catch (err) {
      const e = err as Error & { cause?: Error };
      expect(e.message).toMatch(/directive 'boom' in .* threw: original failure/);
      expect(e.message).toMatch(/:\d+:\d+/); // line:column
      expect(e.cause).toBeInstanceOf(Error);
      expect((e.cause as Error).message).toBe('original failure');
    }
  });
});

describe('escapeHtml + escapeAttribute', () => {
  it('escapeHtml escapes the five canonical chars', () => {
    expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('escapeAttribute behaves the same as escapeHtml (today)', () => {
    expect(escapeAttribute('<x y="z">')).toBe(escapeHtml('<x y="z">'));
  });

  it('leaves safe text untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
    expect(escapeAttribute('a-b_c.d')).toBe('a-b_c.d');
  });
});
