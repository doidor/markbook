import { describe, it, expect } from 'vitest';
import { slugify } from './embed.js';

describe('slugify', () => {
  it('lowercases input', () => {
    expect(slugify('Foo')).toBe('foo');
  });

  it('replaces slashes with dashes (path → kebab)', () => {
    expect(slugify('components/Button/Variants')).toBe('components-button-variants');
  });

  it('strips non-alphanumeric chars', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('collapses runs of dashes', () => {
    expect(slugify('a---b')).toBe('a-b');
  });

  it('strips leading and trailing dashes', () => {
    expect(slugify('-foo-')).toBe('foo');
  });

  it('handles backslashes (Windows-style paths)', () => {
    expect(slugify('components\\Button\\Variants')).toBe('components-button-variants');
  });

  it('preserves digits', () => {
    expect(slugify('button-v2')).toBe('button-v2');
  });
});
