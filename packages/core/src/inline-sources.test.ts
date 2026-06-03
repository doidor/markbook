import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { resolveInlinedSources } from './inline-sources.js';

async function makeTree(layout: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-inline-'));
  for (const [rel, content] of Object.entries(layout)) {
    const abs = path.join(root, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
  }
  return root;
}

describe('resolveInlinedSources', () => {
  it('returns an empty array when no patterns are configured', async () => {
    const root = await makeTree({
      'docs/Story.tsx': `import { Button } from '../src/Button.js';`,
      'src/Button.tsx': `export const Button = () => null;`,
    });
    try {
      const out = await resolveInlinedSources({
        storyAbsPath: path.join(root, 'docs/Story.tsx'),
        root,
        inlinePatterns: [],
      });
      expect(out).toEqual([]);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('inlines a direct relative import that matches a glob', async () => {
    const root = await makeTree({
      'docs/Story.tsx': `import { Button } from '../src/Button.js';\nexport default () => <Button />;`,
      'src/Button.tsx': `export const Button = () => <button>click</button>;`,
    });
    try {
      const out = await resolveInlinedSources({
        storyAbsPath: path.join(root, 'docs/Story.tsx'),
        root,
        inlinePatterns: ['src/**/*'],
      });
      expect(out.map((f) => f.relPath)).toEqual(['src/Button.tsx']);
      expect(out[0]?.content).toContain('export const Button');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('follows transitive relative imports inside an inlined file', async () => {
    const root = await makeTree({
      'docs/Story.tsx': `import { Button } from '../src/Button.js';`,
      'src/Button.tsx': `import './Button.module.css';\nimport { tokens } from './tokens.js';\nexport const Button = () => null;`,
      'src/Button.module.css': `.btn { color: red; }`,
      'src/tokens.tsx': `export const tokens = {};`,
    });
    try {
      const out = await resolveInlinedSources({
        storyAbsPath: path.join(root, 'docs/Story.tsx'),
        root,
        inlinePatterns: ['src/**/*'],
      });
      const paths = out.map((f) => f.relPath).sort();
      expect(paths).toEqual(['src/Button.module.css', 'src/Button.tsx', 'src/tokens.tsx']);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('does NOT inline files that fall outside the eligible globs', async () => {
    const root = await makeTree({
      'docs/Story.tsx': `import { Button } from '../src/Button.js';\nimport { other } from '../src/other.js';`,
      'src/Button.tsx': `export const Button = () => null;`,
      'src/other.tsx': `export const other = 1;`,
    });
    try {
      const out = await resolveInlinedSources({
        storyAbsPath: path.join(root, 'docs/Story.tsx'),
        root,
        inlinePatterns: ['src/Button.*'],
      });
      expect(out.map((f) => f.relPath)).toEqual(['src/Button.tsx']);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('skips bare-module imports (npm packages stay external)', async () => {
    const root = await makeTree({
      'docs/Story.tsx': `import React from 'react';\nimport { Button } from '../src/Button.js';`,
      'src/Button.tsx': `import { useState } from 'react';\nexport const Button = () => null;`,
    });
    try {
      const out = await resolveInlinedSources({
        storyAbsPath: path.join(root, 'docs/Story.tsx'),
        root,
        inlinePatterns: ['src/**/*'],
      });
      expect(out.map((f) => f.relPath)).toEqual(['src/Button.tsx']);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('resolves .js → .tsx (TS NodeNext convention)', async () => {
    const root = await makeTree({
      'docs/Story.tsx': `import { Button } from '../src/Button.js';`,
      'src/Button.tsx': `export const Button = () => null;`,
    });
    try {
      const out = await resolveInlinedSources({
        storyAbsPath: path.join(root, 'docs/Story.tsx'),
        root,
        inlinePatterns: ['src/**/*'],
      });
      expect(out).toHaveLength(1);
      expect(out[0]?.relPath).toBe('src/Button.tsx');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('resolves an extensionless import to a sibling index.tsx', async () => {
    const root = await makeTree({
      'docs/Story.tsx': `import { stuff } from '../src/stuff';`,
      'src/stuff/index.tsx': `export const stuff = 1;`,
    });
    try {
      const out = await resolveInlinedSources({
        storyAbsPath: path.join(root, 'docs/Story.tsx'),
        root,
        inlinePatterns: ['src/**/*'],
      });
      expect(out.map((f) => f.relPath)).toEqual(['src/stuff/index.tsx']);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('handles export-from declarations', async () => {
    const root = await makeTree({
      'docs/Story.tsx': `import { Button } from '../src/index.js';`,
      'src/index.tsx': `export { Button } from './Button.js';`,
      'src/Button.tsx': `export const Button = () => null;`,
    });
    try {
      const out = await resolveInlinedSources({
        storyAbsPath: path.join(root, 'docs/Story.tsx'),
        root,
        inlinePatterns: ['src/**/*'],
      });
      const paths = out.map((f) => f.relPath).sort();
      expect(paths).toEqual(['src/Button.tsx', 'src/index.tsx']);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('returns null-safe results when a file is missing on disk', async () => {
    const root = await makeTree({
      'docs/Story.tsx': `import { Missing } from '../src/missing.js';\nimport { Real } from '../src/real.js';`,
      'src/real.tsx': `export const Real = () => null;`,
    });
    try {
      const out = await resolveInlinedSources({
        storyAbsPath: path.join(root, 'docs/Story.tsx'),
        root,
        inlinePatterns: ['src/**/*'],
      });
      expect(out.map((f) => f.relPath)).toEqual(['src/real.tsx']);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('does not include the story file itself in the output', async () => {
    const root = await makeTree({
      'docs/Story.tsx': `import { Button } from '../src/Button.js';`,
      'src/Button.tsx': `export const Button = () => null;`,
    });
    try {
      const out = await resolveInlinedSources({
        storyAbsPath: path.join(root, 'docs/Story.tsx'),
        root,
        inlinePatterns: ['src/**/*', 'docs/**/*'],
      });
      expect(out.map((f) => f.relPath)).toEqual(['src/Button.tsx']);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
