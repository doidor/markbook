import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { staticAdapter } from './config.js';
import { createContext } from './build.js';

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

describe('createContext — content + layouts wiring', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-ctx-'));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('defaults docsDir to <root>/docs when neither contentDir nor docsDir is set', async () => {
    const ctx = await createContext({ root: tmp });
    expect(ctx.docsDir).toBe(path.resolve(tmp, 'docs'));
  });

  it('honours the legacy `docsDir` config field', async () => {
    const ctx = await createContext({ root: tmp, docsDir: 'content' });
    expect(ctx.docsDir).toBe(path.resolve(tmp, 'content'));
  });

  it('honours the new `contentDir` config field', async () => {
    const ctx = await createContext({ root: tmp, contentDir: 'pages' });
    expect(ctx.docsDir).toBe(path.resolve(tmp, 'pages'));
  });

  it('throws when both `contentDir` and `docsDir` are set (no silent precedence)', async () => {
    await expect(
      createContext({ root: tmp, contentDir: 'pages', docsDir: 'docs' }),
    ).rejects.toThrow(/both `contentDir` and `docsDir` are set/);
  });

  it('defaults layoutsDir to <root>/layouts', async () => {
    const ctx = await createContext({ root: tmp });
    expect(ctx.layoutDirs).toEqual([path.resolve(tmp, 'layouts')]);
  });

  it('accepts a single layoutsDir string', async () => {
    const ctx = await createContext({ root: tmp, layoutsDir: 'shells' });
    expect(ctx.layoutDirs).toEqual([path.resolve(tmp, 'shells')]);
  });

  it('accepts a layoutsDir array, preserving order, resolved to absolute paths', async () => {
    const ctx = await createContext({
      root: tmp,
      layoutsDir: ['shells', '../shared/layouts'],
    });
    expect(ctx.layoutDirs).toEqual([
      path.resolve(tmp, 'shells'),
      path.resolve(tmp, '../shared/layouts'),
    ]);
  });

  it('absolute layoutsDir paths pass through unchanged', async () => {
    const absolute = path.resolve(tmp, 'somewhere/else');
    const ctx = await createContext({ root: tmp, layoutsDir: absolute });
    expect(ctx.layoutDirs).toEqual([absolute]);
  });

  it('defaultLayout is null when `config.layout` is unset', async () => {
    const ctx = await createContext({ root: tmp });
    expect(ctx.defaultLayout).toBeNull();
  });

  it('stores `config.layout` as the default layout name', async () => {
    const ctx = await createContext({ root: tmp, layout: 'marketing' });
    expect(ctx.defaultLayout).toBe('marketing');
  });

  it('siteTitle is null when title is unset (per-page titles take over)', async () => {
    const ctx = await createContext({ root: tmp });
    expect(ctx.siteTitle).toBeNull();
  });

  it('llmsButtons defaults to true; explicit false flips it', async () => {
    const onCtx = await createContext({ root: tmp });
    expect(onCtx.llmsButtons).toBe(true);
    const offCtx = await createContext({ root: tmp, llmsButtons: false });
    expect(offCtx.llmsButtons).toBe(false);
  });

  it('disableBaseCss defaults to false; explicit true flips it', async () => {
    const onCtx = await createContext({ root: tmp });
    expect(onCtx.disableBaseCss).toBe(false);
    const offCtx = await createContext({ root: tmp, disableBaseCss: true });
    expect(offCtx.disableBaseCss).toBe(true);
  });

  it('uses staticAdapter() implicitly when no adapter is configured', async () => {
    const ctx = await createContext({ root: tmp });
    expect(ctx.adapter.isStatic).toBe(true);
    expect(ctx.adapterPackageName).toBe('@markbook/core');
  });
});
