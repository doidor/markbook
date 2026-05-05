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
      expect(result?.code).toBe(source.trim());
      expect(result?.codeHtml).toContain('shiki');
      expect(result?.codeHtml).toContain('import');
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
      expect(result?.codeHtml).toContain('shiki');
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
