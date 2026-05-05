import { describe, it, expect } from 'vitest';
import {
  capitalize,
  isIndexHref,
  sortIndexFirst,
  type NavItem,
} from './build.js';

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
    const items = [
      item('b', 'b.html'),
      item('idx', 'index.html'),
      item('a', 'a.html'),
    ];
    const sorted = sortIndexFirst(items);
    expect(sorted[0]?.htmlRelPath).toBe('index.html');
    expect(sorted[1]?.htmlRelPath).toBe('b.html');
    expect(sorted[2]?.htmlRelPath).toBe('a.html');
  });

  it('moves a nested index (components/index.html) to the front of its group', () => {
    const items = [
      item('b', 'components/b.html'),
      item('i', 'components/index.html'),
    ];
    expect(sortIndexFirst(items)[0]?.htmlRelPath).toBe(
      'components/index.html',
    );
  });

  it('does not mutate the input array', () => {
    const items = [item('b', 'b.html'), item('idx', 'index.html')];
    const original = [...items];
    sortIndexFirst(items);
    expect(items).toEqual(original);
  });
});
