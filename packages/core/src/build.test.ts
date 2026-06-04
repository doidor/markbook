import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import {
  capitalize,
  isIndexHref,
  makeLoadHtmlLayout,
  normalizeSiteUrl,
  resolvePageLayout,
  sortIndexFirst,
  type NavItem,
} from './build.js';
import type { ParsedPage } from './parse.js';

const item = (id: string, htmlRelPath: string): NavItem => ({
  id,
  title: id,
  htmlRelPath,
});

describe('capitalize', () => {
  it('uppercases the first character', () => {
    expect(capitalize('foo')).toBe('Foo');
  });
  it('returns empty string unchanged', () => {
    expect(capitalize('')).toBe('');
  });
  it('does not lowercase the tail', () => {
    expect(capitalize('foo BAR')).toBe('Foo BAR');
  });
});

describe('isIndexHref', () => {
  it('matches top-level index.html', () => {
    expect(isIndexHref('index.html')).toBe(true);
  });
  it('matches nested index.html', () => {
    expect(isIndexHref('components/index.html')).toBe(true);
  });
  it('rejects non-index files', () => {
    expect(isIndexHref('Button.html')).toBe(false);
    expect(isIndexHref('components/Button.html')).toBe(false);
  });
});

describe('sortIndexFirst', () => {
  it('keeps order if no index page exists', () => {
    const items = [item('a', 'a.html'), item('b', 'b.html')];
    expect(sortIndexFirst(items)).toEqual(items);
  });

  it('moves a top-level index page to the front', () => {
    const items = [item('b', 'b.html'), item('idx', 'index.html'), item('a', 'a.html')];
    const sorted = sortIndexFirst(items);
    expect(sorted[0]?.htmlRelPath).toBe('index.html');
    expect(sorted[1]?.htmlRelPath).toBe('b.html');
    expect(sorted[2]?.htmlRelPath).toBe('a.html');
  });

  it('moves a nested index (components/index.html) to the front of its group', () => {
    const items = [item('b', 'components/b.html'), item('i', 'components/index.html')];
    expect(sortIndexFirst(items)[0]?.htmlRelPath).toBe('components/index.html');
  });

  it('does not mutate the input array', () => {
    const items = [item('b', 'b.html'), item('idx', 'index.html')];
    const original = [...items];
    sortIndexFirst(items);
    expect(items).toEqual(original);
  });
});

describe('makeLoadHtmlLayout', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-loader-'));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('loads a layout file from a single directory', async () => {
    const dir = path.join(tmp, 'layouts');
    await fs.mkdir(dir);
    await fs.writeFile(path.join(dir, 'default.html'), '<html>HELLO</html>');
    const load = makeLoadHtmlLayout([dir], tmp);
    expect(await load('default')).toBe('<html>HELLO</html>');
  });

  it('searches directories in order — first match wins', async () => {
    const a = path.join(tmp, 'a');
    const b = path.join(tmp, 'b');
    await fs.mkdir(a);
    await fs.mkdir(b);
    await fs.writeFile(path.join(a, 'shared.html'), 'FROM_A');
    await fs.writeFile(path.join(b, 'shared.html'), 'FROM_B');
    const load = makeLoadHtmlLayout([a, b], tmp);
    expect(await load('shared')).toBe('FROM_A');
  });

  it('falls through to the next directory when the first lacks the file', async () => {
    const a = path.join(tmp, 'a');
    const b = path.join(tmp, 'b');
    await fs.mkdir(a);
    await fs.mkdir(b);
    await fs.writeFile(path.join(b, 'only-in-b.html'), 'B');
    const load = makeLoadHtmlLayout([a, b], tmp);
    expect(await load('only-in-b')).toBe('B');
  });

  it('throws a clear error mentioning the searched dirs when not found', async () => {
    const dir = path.join(tmp, 'layouts');
    await fs.mkdir(dir);
    const load = makeLoadHtmlLayout([dir], tmp);
    await expect(load('missing')).rejects.toThrow(/HTML layout 'missing' not found in: layouts\./);
  });

  it('error message names "no layoutsDir configured" when given an empty list', async () => {
    const load = makeLoadHtmlLayout([], tmp);
    await expect(load('whatever')).rejects.toThrow(/no layoutsDir configured/);
  });

  it('rethrows non-ENOENT filesystem errors instead of falling through', async () => {
    // Use a path that exists as a FILE (so reading <file>/foo.html throws ENOTDIR,
    // not ENOENT — should surface).
    const file = path.join(tmp, 'not-a-dir');
    await fs.writeFile(file, 'x');
    const load = makeLoadHtmlLayout([file], tmp);
    await expect(load('any')).rejects.toThrow();
  });
});

describe('resolvePageLayout', () => {
  function makePage(frontmatter: Record<string, unknown>) {
    const parsed: ParsedPage = {
      frontmatter,
      html: '',
      plainText: '',
      plainMarkdown: '',
      stories: [],
      headings: [],
      title: 'x',
    };
    return {
      file: '/x/index.md',
      relPath: 'index.md',
      htmlRelPath: 'index.html',
      entryRelPath: 'index.entry.ts',
      txtRelPath: 'index.txt',
      fileId: 'index',
      groupKey: null,
      parsed,
    };
  }

  it('returns null when no frontmatter layout and no default', () => {
    expect(resolvePageLayout(makePage({}), null)).toBeNull();
  });

  it('falls back to the config default when frontmatter has no layout', () => {
    expect(resolvePageLayout(makePage({}), 'default')).toBe('default');
  });

  it('frontmatter layout string overrides the config default', () => {
    expect(resolvePageLayout(makePage({ layout: 'landing' }), 'default')).toBe('landing');
  });

  it('frontmatter layout: false forces null (opts out of the default)', () => {
    expect(resolvePageLayout(makePage({ layout: false }), 'default')).toBeNull();
  });

  it('throws on invalid frontmatter layout types (number, object, etc.)', () => {
    expect(() => resolvePageLayout(makePage({ layout: 42 }), 'default')).toThrow(
      /invalid `layout:` frontmatter — expected a string layout name or `false`/,
    );
    expect(() => resolvePageLayout(makePage({ layout: { name: 'x' } }), null)).toThrow(
      /invalid `layout:` frontmatter/,
    );
  });

  it('treats frontmatter layout: true as invalid (not a string)', () => {
    expect(() => resolvePageLayout(makePage({ layout: true }), null)).toThrow(
      /invalid `layout:` frontmatter/,
    );
  });
});

describe('normalizeSiteUrl', () => {
  it('returns null for undefined, null, or empty input', () => {
    expect(normalizeSiteUrl(undefined)).toBeNull();
    expect(normalizeSiteUrl(null)).toBeNull();
    expect(normalizeSiteUrl('')).toBeNull();
  });

  it('strips trailing slash', () => {
    expect(normalizeSiteUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizeSiteUrl('https://example.com')).toBe('https://example.com');
  });

  it('preserves a base path (origin + path) and strips its trailing slash', () => {
    expect(normalizeSiteUrl('https://example.com/docs/')).toBe('https://example.com/docs');
    expect(normalizeSiteUrl('https://example.com/docs')).toBe('https://example.com/docs');
  });

  it('accepts http and https', () => {
    expect(normalizeSiteUrl('http://localhost:3000')).toBe('http://localhost:3000');
    expect(normalizeSiteUrl('https://example.com')).toBe('https://example.com');
  });

  it('rejects other protocols', () => {
    expect(() => normalizeSiteUrl('ftp://example.com')).toThrow(/must use http or https/);
    expect(() => normalizeSiteUrl('file:///etc/passwd')).toThrow(/must use http or https/);
  });

  it('rejects query strings and fragments', () => {
    expect(() => normalizeSiteUrl('https://example.com?foo=1')).toThrow(
      /must not contain a query string or fragment/,
    );
    expect(() => normalizeSiteUrl('https://example.com#bar')).toThrow(
      /must not contain a query string or fragment/,
    );
  });

  it('rejects malformed URLs with a clear error', () => {
    expect(() => normalizeSiteUrl('not a url')).toThrow(/invalid siteUrl/);
    expect(() => normalizeSiteUrl('//example.com')).toThrow(/invalid siteUrl/);
  });
});
