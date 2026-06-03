import { describe, it, expect } from 'vitest';
import { applyTemplate, applyHtmlLayout, type HtmlLayoutSubstitutions } from './template.js';

describe('applyTemplate', () => {
  it('substitutes simple {{ key }} variables from frontmatter', () => {
    const result = applyTemplate(
      'body content',
      { title: 'Hello' },
      '# {{ title }}\n\n{{ content }}',
    );
    expect(result).toBe('# Hello\n\nbody content');
  });

  it('returns empty string for missing keys', () => {
    expect(applyTemplate('', {}, '[{{ unknown }}]')).toBe('[]');
  });

  it('supports dot-path access via frontmatter.x.y', () => {
    const result = applyTemplate(
      '',
      { meta: { author: 'Tudor' } },
      'by {{ frontmatter.meta.author }}',
    );
    expect(result).toBe('by Tudor');
  });

  it('stringifies numbers and booleans', () => {
    expect(applyTemplate('', { count: 42, enabled: true }, '{{ count }}/{{ enabled }}')).toBe(
      '42/true',
    );
  });

  it('JSON-stringifies object values', () => {
    expect(applyTemplate('', { obj: { a: 1 } }, '{{ obj }}')).toBe('{"a":1}');
  });

  it('preserves the template if no tokens are present', () => {
    const tpl = '# Static\n\nNo variables.';
    expect(applyTemplate('', {}, tpl)).toBe(tpl);
  });

  it('handles missing dot-path segments as empty', () => {
    expect(applyTemplate('', {}, '{{ frontmatter.a.b.c }}')).toBe('');
  });
});

describe('applyHtmlLayout', () => {
  function subs(overrides: Partial<HtmlLayoutSubstitutions> = {}): HtmlLayoutSubstitutions {
    return {
      raw: {
        content: '<p>BODY</p>',
        head: '<script>HEAD</script>',
        bodyEnd: '<script>END</script>',
        pageActions: '<div>ACTIONS</div>',
        search: '<div>SEARCH</div>',
        themeToggle: '<button>THEME</button>',
        ...(overrides.raw ?? {}),
      },
      text: {
        title: 'Page Title',
        description: 'Page description',
        siteTitle: 'My Site',
        browserTitle: 'Page Title — My Site',
        ...(overrides.text ?? {}),
      },
    };
  }

  it('substitutes raw HTML tokens verbatim', () => {
    const result = applyHtmlLayout(
      '<html><body>{{ content }}{{ bodyEnd }}</body></html>',
      subs(),
      {},
      'test',
    );
    expect(result).toBe('<html><body><p>BODY</p><script>END</script></body></html>');
  });

  it('HTML-escapes text tokens', () => {
    const result = applyHtmlLayout(
      '<title>{{ browserTitle }}</title>{{ content }}',
      subs({ text: { title: '', description: '', siteTitle: '', browserTitle: 'X & Y <Z>' } }),
      {},
      'test',
    );
    expect(result).toContain('<title>X &amp; Y &lt;Z&gt;</title>');
  });

  it('HTML-escapes frontmatter tokens (XSS guard)', () => {
    const fm = { author: '<script>alert(1)</script>' };
    const result = applyHtmlLayout(
      '<meta name="author" content="{{ frontmatter.author }}">{{ content }}',
      subs(),
      fm,
      'test',
    );
    expect(result).toContain('content="&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(result).not.toContain('<script>alert(1)</script>');
  });

  it('supports nested dot-path frontmatter access', () => {
    const result = applyHtmlLayout(
      '<p>{{ frontmatter.author.name }}</p>{{ content }}',
      subs(),
      { author: { name: 'Tudor' } },
      'test',
    );
    expect(result).toContain('<p>Tudor</p>');
  });

  it('renders empty for missing frontmatter paths', () => {
    const result = applyHtmlLayout(
      '<p>{{ frontmatter.missing }}</p>{{ content }}',
      subs(),
      {},
      'test',
    );
    expect(result).toContain('<p></p>');
  });

  it('throws when {{ content }} is missing', () => {
    expect(() =>
      applyHtmlLayout('<html><body>no content slot</body></html>', subs(), {}, 'default'),
    ).toThrow(/HTML layout 'default' is missing a \{\{ content \}\} placeholder/);
  });

  it('throws when {{ content }} appears more than once', () => {
    expect(() => applyHtmlLayout('{{ content }} ... {{ content }}', subs(), {}, 'default')).toThrow(
      /HTML layout 'default' has 2 \{\{ content \}\} placeholders/,
    );
  });

  it('throws on unknown placeholder names (typo guard)', () => {
    expect(() =>
      applyHtmlLayout('<title>{{ tilte }}</title>{{ content }}', subs(), {}, 'broken'),
    ).toThrow(/uses unknown placeholder \{\{ tilte \}\}/);
  });

  it('allows whitespace around placeholder names', () => {
    const result = applyHtmlLayout(
      '<p>{{title}}</p><p>{{ title }}</p><p>{{   title   }}</p>{{ content }}',
      subs(),
      {},
      'test',
    );
    expect(result).toContain('<p>Page Title</p><p>Page Title</p><p>Page Title</p>');
  });

  it('substitutes all eleven canonical tokens', () => {
    const layout = [
      '{{ title }}',
      '{{ description }}',
      '{{ siteTitle }}',
      '{{ browserTitle }}',
      '{{ head }}',
      '{{ bodyEnd }}',
      '{{ pageActions }}',
      '{{ search }}',
      '{{ themeToggle }}',
      '{{ content }}',
    ].join('|');
    const result = applyHtmlLayout(layout, subs(), {}, 'test');
    expect(result).toBe(
      [
        'Page Title',
        'Page description',
        'My Site',
        'Page Title — My Site',
        '<script>HEAD</script>',
        '<script>END</script>',
        '<div>ACTIONS</div>',
        '<div>SEARCH</div>',
        '<button>THEME</button>',
        '<p>BODY</p>',
      ].join('|'),
    );
  });

  it('empty siteTitle / description still escape correctly', () => {
    const result = applyHtmlLayout(
      '<meta content="{{ siteTitle }}">{{ content }}',
      subs({ text: { title: '', description: '', siteTitle: '', browserTitle: '' } }),
      {},
      'test',
    );
    expect(result).toContain('<meta content="">');
  });

  it('ignores placeholders inside HTML comments and preserves the comments', () => {
    // The comment mentions {{ content }} — without protection, it would
    // count as a second content slot and fail validation. With protection,
    // the comment stays in the output unchanged.
    const layout = `<!-- author note: drop {{ content }} below; do NOT use {{ tilte }} (typo) -->
<html><body>{{ content }}</body></html>`;
    const result = applyHtmlLayout(layout, subs(), {}, 'documented');
    expect(result).toContain(
      '<!-- author note: drop {{ content }} below; do NOT use {{ tilte }} (typo) -->',
    );
    expect(result).toContain('<html><body><p>BODY</p></body></html>');
  });

  it('still validates {{ content }} count when only comment mentions exist outside the real slot', () => {
    expect(() =>
      applyHtmlLayout('<!-- {{ content }} -->no real slot', subs(), {}, 'broken'),
    ).toThrow(/missing a \{\{ content \}\} placeholder/);
  });
});
