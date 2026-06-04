import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { htmlTemplate } from './html-template.js';

describe('htmlTemplate', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-html-template-'));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('substitutes {{ key }} from the vars map', async () => {
    const file = path.join(tmp, 'simple.html');
    await fs.writeFile(file, '<p>{{ greeting }}, {{ name }}!</p>');
    const render = htmlTemplate(file);
    expect(render({ greeting: 'Hi', name: 'Tudor' })).toBe('<p>Hi, Tudor!</p>');
  });

  it('supports {{ key.dot.path }} drilldown', async () => {
    const file = path.join(tmp, 'nested.html');
    await fs.writeFile(file, '<p>{{ user.name }} from {{ user.location.city }}</p>');
    const render = htmlTemplate(file);
    expect(render({ user: { name: 'Ada', location: { city: 'London' } } })).toBe(
      '<p>Ada from London</p>',
    );
  });

  it('accepts a URL (recommended: new URL(...) form)', async () => {
    const file = path.join(tmp, 'urled.html');
    await fs.writeFile(file, '<x>{{ value }}</x>');
    const render = htmlTemplate(pathToFileURL(file));
    expect(render({ value: 42 })).toBe('<x>42</x>');
  });

  it('renders missing keys as empty string (no throw)', async () => {
    const file = path.join(tmp, 'missing.html');
    await fs.writeFile(file, '<p>[{{ present }}][{{ missing }}][{{ a.b.c }}]</p>');
    const render = htmlTemplate(file);
    expect(render({ present: 'ok' })).toBe('<p>[ok][][]</p>');
  });

  it('stringifies numbers, booleans, and JSON-stringifies objects', async () => {
    const file = path.join(tmp, 'types.html');
    await fs.writeFile(file, '{{ n }}/{{ b }}/{{ o }}');
    const render = htmlTemplate(file);
    expect(render({ n: 42, b: true, o: { x: 1 } })).toBe('42/true/{"x":1}');
  });

  it('passes string values through verbatim (no HTML escaping)', async () => {
    const file = path.join(tmp, 'raw.html');
    await fs.writeFile(file, '<div>{{ html }}</div>');
    const render = htmlTemplate(file);
    expect(render({ html: '<strong>bold</strong>' })).toBe('<div><strong>bold</strong></div>');
  });

  it('preserves HTML comments and does NOT substitute placeholders inside them', async () => {
    const file = path.join(tmp, 'commented.html');
    await fs.writeFile(
      file,
      `<!-- author note: {{ type }} should be info|tip|warning -->
<aside class="callout callout-{{ type }}">{{ content }}</aside>`,
    );
    const render = htmlTemplate(file);
    const out = render({ type: 'info', content: '<p>x</p>' });
    expect(out).toContain('<!-- author note: {{ type }} should be info|tip|warning -->');
    expect(out).toContain('<aside class="callout callout-info"><p>x</p></aside>');
  });

  it('loads the file once (cached) across multiple render calls', async () => {
    const file = path.join(tmp, 'cached.html');
    await fs.writeFile(file, 'v={{ n }}');
    const render = htmlTemplate(file);

    expect(render({ n: 1 })).toBe('v=1');
    // Mutate the file on disk — render() should still return the cached body.
    await fs.writeFile(file, 'changed={{ n }}');
    expect(render({ n: 2 })).toBe('v=2');
  });

  it('shares the same cache across multiple htmlTemplate() instances for the same path', async () => {
    const file = path.join(tmp, 'shared.html');
    await fs.writeFile(file, 'x={{ x }}');
    const a = htmlTemplate(file);
    const b = htmlTemplate(file);
    expect(a({ x: 1 })).toBe('x=1');
    // Mutate the file; B should still see the cached version (because A read first).
    await fs.writeFile(file, 'changed={{ x }}');
    expect(b({ x: 2 })).toBe('x=2');
  });

  it('throws a clear error when the file is missing (lazy — at first render)', async () => {
    const render = htmlTemplate('/nonexistent/file.html');
    expect(() => render({})).toThrow(/htmlTemplate could not read '\/nonexistent\/file.html'/);
  });

  it('whitespace inside {{ key }} is tolerated', async () => {
    const file = path.join(tmp, 'ws.html');
    await fs.writeFile(file, '[{{name}}][{{ name }}][{{   name   }}]');
    const render = htmlTemplate(file);
    expect(render({ name: 'x' })).toBe('[x][x][x]');
  });

  it('multiple placeholders for the same key resolve consistently', async () => {
    const file = path.join(tmp, 'repeat.html');
    await fs.writeFile(file, '{{ x }}-{{ x }}-{{ x }}');
    const render = htmlTemplate(file);
    expect(render({ x: 'a' })).toBe('a-a-a');
  });
});
