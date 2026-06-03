import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { resolveSpec, isPathLikeSpec } from './resolve.js';

async function makeTree(layout: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-resolve-'));
  for (const [rel, content] of Object.entries(layout)) {
    const abs = path.join(root, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
  }
  return root;
}

describe('isPathLikeSpec', () => {
  it('identifies relative imports', () => {
    expect(isPathLikeSpec('./Foo.tsx')).toBe(true);
    expect(isPathLikeSpec('../Bar')).toBe(true);
  });
  it('identifies absolute paths', () => {
    expect(isPathLikeSpec('/abs/path')).toBe(true);
  });
  it('rejects bare specifiers', () => {
    expect(isPathLikeSpec('@my-org/button')).toBe(false);
    expect(isPathLikeSpec('react')).toBe(false);
    expect(isPathLikeSpec('lodash/get')).toBe(false);
  });
});

describe('resolveSpec', () => {
  it('returns absolute paths as-is', () => {
    expect(resolveSpec('/abs/path', '/anywhere')).toBe('/abs/path');
  });

  it('resolves relative paths against fromDir', () => {
    expect(resolveSpec('./Foo.tsx', '/page/dir')).toBe('/page/dir/Foo.tsx');
    expect(resolveSpec('../Bar.tsx', '/page/dir')).toBe('/page/Bar.tsx');
  });

  it('resolves bare specifiers via Node module resolution', async () => {
    const root = await makeTree({
      'package.json': JSON.stringify({}),
      'node_modules/@my-org/button/package.json': JSON.stringify({
        name: '@my-org/button',
        main: './dist/index.js',
        types: './dist/index.d.ts',
      }),
      'node_modules/@my-org/button/dist/index.js': `export const Button = () => null;`,
      'node_modules/@my-org/button/dist/index.d.ts': `export const Button: () => null;`,
    });
    try {
      const real = await fs.realpath(root);
      const resolved = resolveSpec('@my-org/button', root);
      expect(resolved).toBe(path.join(real, 'node_modules/@my-org/button/dist/index.js'));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('returns null for an unresolvable bare specifier', () => {
    expect(resolveSpec('@no-such-org/no-such-pkg', '/tmp')).toBeNull();
  });

  it('resolves subpath imports under a package (e.g. `lodash/get`)', async () => {
    const root = await makeTree({
      'package.json': JSON.stringify({}),
      'node_modules/lib/package.json': JSON.stringify({ name: 'lib' }),
      'node_modules/lib/sub.js': `export const sub = 1;`,
    });
    try {
      const real = await fs.realpath(root);
      const resolved = resolveSpec('lib/sub.js', root);
      expect(resolved).toBe(path.join(real, 'node_modules/lib/sub.js'));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
