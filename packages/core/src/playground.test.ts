import { describe, it, expect } from 'vitest';
import { buildPlaygroundDescriptors } from './playground.js';

const baseFile = {
  path: 'Variants.stories.tsx',
  content: `import { Button } from './Button.js';\nexport default () => <Button>Hi</Button>;\n`,
};

describe('buildPlaygroundDescriptors', () => {
  it('returns one descriptor when a single provider is configured', () => {
    const out = buildPlaygroundDescriptors({
      storyFiles: [baseFile],
      config: { providers: 'codesandbox' },
      storyEntryFile: baseFile.path,
      title: 'Variants',
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.provider).toBe('codesandbox');
  });

  it('returns one descriptor per provider when an array is configured', () => {
    const out = buildPlaygroundDescriptors({
      storyFiles: [baseFile],
      config: { providers: ['codesandbox', 'stackblitz'] },
      storyEntryFile: baseFile.path,
      title: 'Variants',
    });
    expect(out.map((d) => d.provider)).toEqual(['codesandbox', 'stackblitz']);
  });

  it('CodeSandbox payload encodes file map under the `parameters` field', () => {
    const out = buildPlaygroundDescriptors({
      storyFiles: [baseFile],
      config: { providers: 'codesandbox' },
      storyEntryFile: baseFile.path,
      title: 'Variants',
    });
    const cs = out[0]!;
    expect(cs.action).toContain('codesandbox.io');
    expect(cs.action).toContain('json=1');
    const [name, value] = cs.fields[0]!;
    expect(name).toBe('parameters');
    const parsed = JSON.parse(value);
    expect(parsed.files['package.json']).toBeDefined();
    expect(parsed.files['public/index.html']).toBeDefined();
    expect(parsed.files['src/index.tsx']).toBeDefined();
    expect(parsed.files['src/Variants.stories.tsx']).toBeDefined();
    expect(parsed.files['src/Variants.stories.tsx'].content).toContain('export default');
  });

  it('StackBlitz fields include project[template], dependencies, and one entry per file', () => {
    const out = buildPlaygroundDescriptors({
      storyFiles: [baseFile],
      config: { providers: 'stackblitz', dependencies: { react: '18.3.1', 'react-dom': '18.3.1' } },
      storyEntryFile: baseFile.path,
      title: 'Variants',
    });
    const sb = out[0]!;
    expect(sb.action).toBe('https://stackblitz.com/run');
    const fieldNames = sb.fields.map(([n]) => n);
    expect(fieldNames).toContain('project[title]');
    expect(fieldNames).toContain('project[template]');
    expect(fieldNames).toContain('project[dependencies][react]');
    expect(fieldNames).toContain('project[dependencies][react-dom]');
    expect(fieldNames).toContain('project[files][package.json]');
    expect(fieldNames).toContain('project[files][src/Variants.stories.tsx]');
  });

  it('falls back to React defaults when dependencies are omitted', () => {
    const out = buildPlaygroundDescriptors({
      storyFiles: [baseFile],
      config: { providers: 'codesandbox' },
      storyEntryFile: baseFile.path,
      title: 'Variants',
    });
    const parsed = JSON.parse(out[0]!.fields[0]![1]);
    const pkg = JSON.parse(parsed.files['package.json'].content);
    expect(pkg.dependencies).toMatchObject({ react: 'latest', 'react-dom': 'latest' });
  });

  it('respects a user-supplied stackblitzTemplate', () => {
    const out = buildPlaygroundDescriptors({
      storyFiles: [baseFile],
      config: { providers: 'stackblitz', stackblitzTemplate: 'create-react-app-typescript' },
      storyEntryFile: baseFile.path,
      title: 'Variants',
    });
    const tplField = out[0]!.fields.find(([n]) => n === 'project[template]')!;
    expect(tplField[1]).toBe('create-react-app-typescript');
  });

  it('includes sibling files (e.g. CSS) under src/', () => {
    const out = buildPlaygroundDescriptors({
      storyFiles: [baseFile, { path: 'Variants.module.css', content: '.row { display: flex; }' }],
      config: { providers: 'stackblitz' },
      storyEntryFile: baseFile.path,
      title: 'Variants',
    });
    const cssField = out[0]!.fields.find(([n]) => n === 'project[files][src/Variants.module.css]');
    expect(cssField).toBeDefined();
    expect(cssField![1]).toBe('.row { display: flex; }');
  });
});
