import { describe, it, expect } from 'vitest';
import { applyTemplate } from './template.js';

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
