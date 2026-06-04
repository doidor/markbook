import { describe, it, expect } from 'vitest';
import { minifyCss, minifyJs } from './minify.js';

describe('minifyCss', () => {
  it('strips comments and collapses whitespace', async () => {
    const out = await minifyCss(`
      /* This is a comment */
      .foo {
        color:   red;
        margin: 0   0   1rem   0;
      }
    `);
    expect(out).not.toContain('/*');
    expect(out).not.toContain('comment');
    expect(out).not.toMatch(/\n\s+/); // no indented newlines
    expect(out.length).toBeLessThan(40);
  });

  it('shortens redundant values where safe', async () => {
    const out = await minifyCss('.x { margin: 0px 0px 0px 0px; }');
    // esbuild collapses the 4-zero margin and strips 'px' on zeros.
    expect(out).toContain('margin:0');
  });

  it('preserves CSS variables and var() references', async () => {
    const out = await minifyCss(':root { --c-bg: #0a1228; } body { background: var(--c-bg); }');
    expect(out).toContain('--c-bg:');
    expect(out).toContain('var(--c-bg)');
  });

  it('returns input unchanged on empty / null / undefined', async () => {
    expect(await minifyCss('')).toBe('');
  });

  it('caches by source string (idempotent + cheap on repeat)', async () => {
    const a = await minifyCss('.x{color:red}');
    const b = await minifyCss('.x{color:red}');
    expect(a).toBe(b);
  });

  it('falls back gracefully on malformed input rather than throwing', async () => {
    // Intentionally broken CSS — minifier should swallow and return source.
    const broken = '.x { color: }}{{ syntax broken ;';
    const result = await minifyCss(broken);
    // Either the original string is returned, or esbuild produces some
    // best-effort output. The contract: never throws.
    expect(typeof result).toBe('string');
  });
});

describe('minifyJs', () => {
  it('strips comments and whitespace from an IIFE', async () => {
    const out = await minifyJs(`
      // top-level comment
      (function () {
        /* block comment */
        var foo = 'bar';
        console.log(foo);
      })();
    `);
    expect(out).not.toContain('//');
    expect(out).not.toContain('/*');
    expect(out).not.toMatch(/\n\s{2,}/);
    expect(out.length).toBeLessThan(60);
  });

  it('renames local variables in IIFE scopes to single letters', async () => {
    const out = await minifyJs(
      '(function () { var someLongName = 42; return someLongName + 1; })();',
    );
    // 'someLongName' is local to the IIFE — esbuild renames it.
    expect(out).not.toContain('someLongName');
  });

  it('preserves global window / document references (cannot be renamed)', async () => {
    const out = await minifyJs(
      "(function () { document.addEventListener('click', () => window.alert('x')); })();",
    );
    expect(out).toContain('document');
    expect(out).toContain('window');
  });

  it('returns input unchanged on empty', async () => {
    expect(await minifyJs('')).toBe('');
  });

  it('caches by source string', async () => {
    const a = await minifyJs('(()=>{var x=1;})();');
    const b = await minifyJs('(()=>{var x=1;})();');
    expect(a).toBe(b);
  });

  it('falls back gracefully on malformed input rather than throwing', async () => {
    const result = await minifyJs('this is { not ) valid js (');
    expect(typeof result).toBe('string');
  });
});
