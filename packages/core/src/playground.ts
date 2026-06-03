import LZString from 'lz-string';
import type { PlaygroundConfig, PlaygroundProvider } from './config.js';

/**
 * A file destined for a sandbox project. `path` is relative to the sandbox
 * root (typically `src/<file>`); `content` is the raw text.
 */
export interface PlaygroundFile {
  path: string;
  content: string;
}

/**
 * Encoded payload for one provider button. The HTML emitter renders a
 * `<button>` that, on click, builds a hidden form with these fields and
 * submits to `action` in a new tab.
 */
export interface PlaygroundFormDescriptor {
  provider: PlaygroundProvider;
  /** Where the form POSTs. */
  action: string;
  /**
   * Form fields as `[name, value]` pairs. The order is preserved so a
   * provider can rely on `project[template]` arriving before
   * `project[files][...]`.
   */
  fields: Array<[string, string]>;
  /** Human label shown on the button. */
  label: string;
}

export interface BuildPlaygroundInput {
  /**
   * Story file (TSX/TS/JSX/JS) and any sibling CSS imports, each at a
   * `path` that places the file under the sandbox `src/` root. For the
   * inlined-source flow, this is the story's `MarkbookConfig.root`-relative
   * path; for simple cases, just the filename.
   */
  storyFiles: PlaygroundFile[];
  config: PlaygroundConfig;
  /**
   * The `storyFiles[].path` of the story entry that the generated
   * `src/index.tsx` imports. The entry resolves `./<this path, minus
   * extension>` relative to `src/`.
   */
  storyEntryFile: string;
  /**
   * Extra source files inlined from the user's repo (resolved by walking
   * the story's relative imports against `MarkbookConfig.playground.
   * inlineSourceImports` globs). Each has a root-relative `path` so the
   * file lands at exactly the location the original relative-import paths
   * expect — no rewriting required.
   */
  inlinedSources?: PlaygroundFile[];
  /** Display title for the sandbox. */
  title: string;
}

const DEFAULT_REACT_DEPS: Record<string, string> = {
  react: 'latest',
  'react-dom': 'latest',
};

/**
 * Build one form descriptor per configured provider. Each descriptor is
 * self-contained — the boot script just iterates the fields and builds a
 * `<form>` on click.
 *
 * Currently emits React-shaped projects (CRA template for StackBlitz; an
 * equivalent file layout for CodeSandbox). Vue and WC support is a future
 * enhancement.
 */
export function buildPlaygroundDescriptors(
  input: BuildPlaygroundInput,
): PlaygroundFormDescriptor[] {
  const providers = Array.isArray(input.config.providers)
    ? input.config.providers
    : [input.config.providers];
  const dependencies = input.config.dependencies ?? DEFAULT_REACT_DEPS;
  const files = buildReactSandboxFiles(
    input.storyFiles,
    input.inlinedSources ?? [],
    input.storyEntryFile,
    dependencies,
  );

  return providers.map((provider) => {
    if (provider === 'codesandbox') {
      return buildCodeSandboxDescriptor(files, input.title);
    }
    return buildStackBlitzDescriptor(files, input.title, dependencies, input.config);
  });
}

/**
 * Layout for a CRA-style React sandbox:
 *   - `package.json` declares the dependencies
 *   - `public/index.html` carries the mount root
 *   - `src/index.tsx` boots React and renders the story's default export
 *   - `src/<storyEntryFile>` is the story source (and sibling CSS imports)
 *   - `src/<rel-path>` for each inlined source file — placed at the same
 *     relative-from-root location as in the user's repo so the original
 *     relative-import paths resolve unchanged.
 */
function buildReactSandboxFiles(
  storyFiles: PlaygroundFile[],
  inlinedSources: PlaygroundFile[],
  storyEntryFile: string,
  dependencies: Record<string, string>,
): PlaygroundFile[] {
  const packageJson = {
    name: 'markbook-playground',
    version: '0.0.0',
    private: true,
    main: 'src/index.tsx',
    dependencies,
    scripts: { start: 'react-scripts start', build: 'react-scripts build' },
  };

  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Markbook playground</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`;

  // The CRA template runs src/index.tsx automatically. Import the story's
  // default export (the convention every Markbook story uses) and mount.
  const importPath = `./${storyEntryFile.replace(/\.(tsx|ts|jsx|js)$/, '')}`;
  const indexEntry = `import { createRoot } from 'react-dom/client';
import Story from '${importPath}';

const el = document.getElementById('root');
if (el) createRoot(el).render(<Story />);
`;

  const out: PlaygroundFile[] = [
    { path: 'package.json', content: JSON.stringify(packageJson, null, 2) },
    { path: 'public/index.html', content: indexHtml },
    { path: 'src/index.tsx', content: indexEntry },
  ];
  // Story + sibling CSS go under src/<their declared path>.
  for (const f of storyFiles) {
    out.push({ path: `src/${f.path}`, content: f.content });
  }
  // Inlined repo source goes under src/<root-relative path>, preserving
  // structure so the original relative-import paths from the story still
  // resolve. e.g. story at src/docs/components/Button/X.stories.tsx +
  // inlined component at src/src/pixie/Button.tsx — the story's existing
  // `'../../../src/pixie/Button.js'` import resolves correctly.
  const seen = new Set(out.map((f) => f.path));
  for (const f of inlinedSources) {
    const dest = `src/${f.path.replace(/\\/g, '/')}`;
    if (seen.has(dest)) continue;
    out.push({ path: dest, content: f.content });
    seen.add(dest);
  }
  return out;
}

function buildCodeSandboxDescriptor(
  files: PlaygroundFile[],
  title: string,
): PlaygroundFormDescriptor {
  // CodeSandbox's `/define` endpoint requires the parameters payload to be
  // LZ-string-compressed and base64-url-encoded. The legacy `?json=1` mode
  // (plain URL-encoded JSON) is deprecated and now returns a generic
  // "Unable to process params" error.
  const parameters = {
    files: Object.fromEntries(files.map((f) => [f.path, { content: f.content }])),
    template: 'create-react-app-typescript',
    title,
  };
  const compressed = LZString.compressToBase64(JSON.stringify(parameters))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return {
    provider: 'codesandbox',
    action: 'https://codesandbox.io/api/v1/sandboxes/define',
    fields: [['parameters', compressed]],
    label: 'Open in CodeSandbox',
  };
}

function buildStackBlitzDescriptor(
  files: PlaygroundFile[],
  title: string,
  dependencies: Record<string, string>,
  config: PlaygroundConfig,
): PlaygroundFormDescriptor {
  const template = config.stackblitzTemplate ?? 'create-react-app';
  const fields: Array<[string, string]> = [
    ['project[title]', title],
    ['project[template]', template],
  ];
  for (const [name, version] of Object.entries(dependencies)) {
    fields.push([`project[dependencies][${name}]`, version]);
  }
  for (const f of files) {
    fields.push([`project[files][${f.path}]`, f.content]);
  }
  return {
    provider: 'stackblitz',
    action: 'https://stackblitz.com/run',
    fields,
    label: 'Open in StackBlitz',
  };
}
