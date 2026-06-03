import { describe, it, expect } from 'vitest';
import { staticAdapter } from './config.js';

describe('staticAdapter', () => {
  it('returns an adapter with isStatic: true', () => {
    const a = staticAdapter();
    expect(a.isStatic).toBe(true);
  });

  it('returns no Vite plugins, no decorators, no controls', () => {
    const a = staticAdapter();
    expect(a.vitePlugins).toBeUndefined();
    expect(a.decoratorModules).toBeUndefined();
    expect(a.hasControls).toBeUndefined();
  });

  it('packageName is a stable sentinel', () => {
    expect(staticAdapter().packageName).toBe('@markbook/core');
  });

  it('two calls produce equivalent shapes (no shared mutable state)', () => {
    const a = staticAdapter();
    const b = staticAdapter();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
