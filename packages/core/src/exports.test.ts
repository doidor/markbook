import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import {
  discoverStoryExports,
  invalidateExportsCache,
  kebabExportName,
  humanizeExportName,
} from './exports.js';

async function withTempFile(
  source: string,
  ext: string,
  fn: (file: string) => Promise<void>,
): Promise<void> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-exp-'));
  try {
    const file = path.join(tmp, `Story.stories${ext}`);
    await fs.writeFile(file, source);
    invalidateExportsCache(file);
    await fn(file);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

describe('discoverStoryExports', () => {
  it('returns null when the file is missing', async () => {
    const result = await discoverStoryExports('/no/such/file.stories.tsx');
    expect(result).toBeNull();
  });

  it('returns named runtime exports in source order', async () => {
    await withTempFile(
      `export const Primary = () => null;
export function Secondary() { return null; }
export class Tertiary {}`,
      '.tsx',
      async (file) => {
        const result = await discoverStoryExports(file);
        expect(result).toEqual(['Primary', 'Secondary', 'Tertiary']);
      },
    );
  });

  it('skips type-only exports (type alias, interface, type re-export, isTypeOnly)', async () => {
    await withTempFile(
      `export type T = string;
export interface I { a: number }
export type { I as IRe };
export { type Foo } from './other.js';
export const Real = () => null;`,
      '.tsx',
      async (file) => {
        const result = await discoverStoryExports(file);
        expect(result).toEqual(['Real']);
      },
    );
  });

  it('includes named re-exports that are not type-only', async () => {
    await withTempFile(
      `export const Local = () => null;
export { Other as ReExported } from './other.js';`,
      '.tsx',
      async (file) => {
        const result = await discoverStoryExports(file);
        expect(result).toEqual(['Local', 'ReExported']);
      },
    );
  });

  it('excludes reserved names: default, args, argTypes, parameters', async () => {
    await withTempFile(
      `export default () => null;
export const args = { foo: 1 };
export const argTypes = { foo: { control: 'text' } };
export const parameters = { layout: 'centered' };
export const Primary = () => null;`,
      '.tsx',
      async (file) => {
        const result = await discoverStoryExports(file);
        expect(result).toEqual(['Primary']);
      },
    );
  });

  it('excludes names starting with underscore (private convention)', async () => {
    await withTempFile(
      `export const _helper = () => null;
export const _ = 1;
export const Primary = () => null;`,
      '.tsx',
      async (file) => {
        const result = await discoverStoryExports(file);
        expect(result).toEqual(['Primary']);
      },
    );
  });

  it('handles .ts, .jsx, .js extensions', async () => {
    const cases: Array<[string, string]> = [
      ['.ts', `export const Foo = () => null;`],
      ['.jsx', `export const Foo = () => null;`],
      ['.js', `export const Foo = () => null;`],
    ];
    for (const [ext, src] of cases) {
      await withTempFile(src, ext, async (file) => {
        const result = await discoverStoryExports(file);
        expect(result).toEqual(['Foo']);
      });
    }
  });
});

describe('kebabExportName', () => {
  it('converts PascalCase', () => {
    expect(kebabExportName('PrimaryButton')).toBe('primary-button');
  });
  it('preserves digits', () => {
    expect(kebabExportName('Header1')).toBe('header1');
  });
  it('collapses non-alphanumeric runs into single dashes', () => {
    expect(kebabExportName('A__B--C')).toBe('a-b-c');
  });
  it('strips leading/trailing dashes', () => {
    expect(kebabExportName('-Foo-')).toBe('foo');
  });
});

describe('humanizeExportName', () => {
  it('splits PascalCase with spaces and capitalizes', () => {
    expect(humanizeExportName('PrimaryButton')).toBe('Primary Button');
  });
  it('replaces underscores and dashes with spaces', () => {
    expect(humanizeExportName('with_underscore_name')).toBe('With underscore name');
  });
  it('returns the original string when nothing to humanize', () => {
    expect(humanizeExportName('Foo')).toBe('Foo');
  });
});
