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

  describe('per-export slicing (exportName !== "default")', () => {
    it('returns just the named export plus the file imports', async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-code-'));
      try {
        const story = path.join(tmp, 'Multi.stories.tsx');
        await fs.writeFile(
          story,
          `import { Button } from './Button.js';
import { Spinner } from './Spinner.js';

export const Primary = () => <Button variant="primary" />;

export const Secondary = () => <Button variant="secondary" />;

export const Loading = () => <Spinner />;
`,
        );
        const result = await extractStoryCode(story, 'Secondary');
        const code = result?.files[0]?.code ?? '';
        expect(code).toContain('import { Button }');
        expect(code).toContain('import { Spinner }');
        expect(code).toContain('export const Secondary');
        expect(code).not.toContain('export const Primary');
        expect(code).not.toContain('export const Loading');
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });

    it('keeps top-level helpers (non-export consts and functions)', async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-code-'));
      try {
        const story = path.join(tmp, 'Helpers.stories.tsx');
        await fs.writeFile(
          story,
          `import { Button } from './Button.js';

const shared = { gap: '1rem' };

function fmt(name: string) { return name.toUpperCase(); }

export const Primary = () => <Button label={fmt('hi')} style={shared} />;

export const Secondary = () => <Button label="b" />;
`,
        );
        const result = await extractStoryCode(story, 'Primary');
        const code = result?.files[0]?.code ?? '';
        expect(code).toContain('const shared = ');
        expect(code).toContain('function fmt');
        expect(code).toContain('export const Primary');
        expect(code).not.toContain('export const Secondary');
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });

    it('preserves JSDoc comments above the export', async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-code-'));
      try {
        const story = path.join(tmp, 'WithDoc.stories.tsx');
        await fs.writeFile(
          story,
          `import { Button } from './Button.js';

/** Primary CTA. */
export const Primary = () => <Button />;

/** Secondary CTA. */
export const Secondary = () => <Button />;
`,
        );
        const result = await extractStoryCode(story, 'Primary');
        const code = result?.files[0]?.code ?? '';
        expect(code).toContain('Primary CTA.');
        expect(code).not.toContain('Secondary CTA.');
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });

    it('skips type-only declarations', async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-code-'));
      try {
        const story = path.join(tmp, 'Typed.stories.tsx');
        await fs.writeFile(
          story,
          `import { Button } from './Button.js';

type Variant = 'a' | 'b';
interface Props { v: Variant }

export const Primary = () => <Button />;
`,
        );
        const result = await extractStoryCode(story, 'Primary');
        const code = result?.files[0]?.code ?? '';
        expect(code).not.toContain('type Variant');
        expect(code).not.toContain('interface Props');
        expect(code).toContain('export const Primary');
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });

    it('falls back to the whole file when the export name is not found', async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-code-'));
      try {
        const story = path.join(tmp, 'Single.stories.tsx');
        const src = `import { Button } from './Button.js';
export const OnlyOne = () => <Button />;`;
        await fs.writeFile(story, src);
        const result = await extractStoryCode(story, 'Missing');
        expect(result?.files[0]?.code).toBe(src.trim());
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });

    it('still surfaces sibling CSS imports in sliced mode', async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-code-'));
      try {
        const story = path.join(tmp, 'Styled.stories.tsx');
        const cssMod = path.join(tmp, 'Styled.module.css');
        await fs.writeFile(
          story,
          `import { Button } from './Button.js';
import styles from './Styled.module.css';
export const Primary = () => <Button className={styles.btn} />;
export const Secondary = () => <Button />;
`,
        );
        await fs.writeFile(cssMod, '.btn { padding: 0.5rem; }');

        const result = await extractStoryCode(story, 'Primary');
        expect(result?.files.map((f) => f.label)).toEqual([
          'Styled.stories.tsx',
          'Styled.module.css',
        ]);
        expect(result?.files[0]?.code).toContain('export const Primary');
        expect(result?.files[0]?.code).not.toContain('export const Secondary');
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });
  });
});
