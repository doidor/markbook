import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { extractStoryCode } from './code.js';

describe('extractStoryCode', () => {
  it('returns null for a missing file', async () => {
    const result = await extractStoryCode('/nonexistent/file.tsx', 'default');
    expect(result).toBeNull();
  });

  it('returns the whole file source + Shiki-highlighted html', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-code-'));
    try {
      const file = path.join(tmp, 'Story.stories.tsx');
      const source = `import { Foo } from './foo.js';

export default () => <Foo />;`;
      await fs.writeFile(file, source);
      const result = await extractStoryCode(file, 'default');
      expect(result).not.toBeNull();
      expect(result?.files).toHaveLength(1);
      expect(result?.files[0]?.label).toBe('Story.stories.tsx');
      expect(result?.files[0]?.lang).toBe('tsx');
      expect(result?.files[0]?.code).toBe(source.trim());
      expect(result?.files[0]?.codeHtml).toContain('shiki');
      expect(result?.files[0]?.codeHtml).toContain('import');
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it('uses ts highlighting for .ts files (not tsx)', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-code-'));
    try {
      const file = path.join(tmp, 'Story.stories.ts');
      await fs.writeFile(file, 'export default () => "hello";');
      const result = await extractStoryCode(file, 'default');
      expect(result?.files[0]?.lang).toBe('ts');
      expect(result?.files[0]?.codeHtml).toContain('shiki');
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it('includes sibling CSS files imported by the story', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-code-'));
    try {
      const story = path.join(tmp, 'Story.stories.tsx');
      const cssMod = path.join(tmp, 'Story.module.css');
      const cssGlobal = path.join(tmp, 'extras.css');
      await fs.writeFile(
        story,
        `import './extras.css';
import styles from './Story.module.css';
export default () => <div className={styles.row} />;`,
      );
      await fs.writeFile(cssMod, '.row { display: flex; gap: 0.5rem; }');
      await fs.writeFile(cssGlobal, ':root { --demo: 1; }');

      const result = await extractStoryCode(story, 'default');
      expect(result?.files.map((f) => f.label)).toEqual([
        'Story.stories.tsx',
        'extras.css',
        'Story.module.css',
      ]);
      expect(result?.files[1]?.lang).toBe('css');
      expect(result?.files[1]?.code).toBe(':root { --demo: 1; }');
      expect(result?.files[2]?.code).toContain('display: flex');
      expect(result?.files[2]?.codeHtml).toContain('shiki');
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it('skips bare-module CSS specifiers (npm packages)', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-code-'));
    try {
      const story = path.join(tmp, 'Story.stories.tsx');
      await fs.writeFile(
        story,
        `import 'some-pkg/styles.css';
export default () => null;`,
      );
      const result = await extractStoryCode(story, 'default');
      expect(result?.files).toHaveLength(1);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it('ignores non-CSS imports', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-code-'));
    try {
      const story = path.join(tmp, 'Story.stories.tsx');
      await fs.writeFile(
        story,
        `import { foo } from './foo.js';
import bar from '../bar.json';
export default () => null;`,
      );
      const result = await extractStoryCode(story, 'default');
      expect(result?.files).toHaveLength(1);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
