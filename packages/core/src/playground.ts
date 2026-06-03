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
  storyFiles: PlaygroundFile[];
  config: PlaygroundConfig;
  /** Filename of the story's main file (e.g. `Variants.stories.tsx`). */
  storyEntryFile: string;
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
  const files = buildReactSandboxFiles(input.storyFiles, input.storyEntryFile, dependencies);

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
 *   - `src/<storyFile>` is the story source (and sibling CSS imports)
 */
function buildReactSandboxFiles(
  storyFiles: PlaygroundFile[],
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
  for (const f of storyFiles) {
    out.push({ path: `src/${f.path}`, content: f.content });
  }
  return out;
}

function buildCodeSandboxDescriptor(
  files: PlaygroundFile[],
  title: string,
): PlaygroundFormDescriptor {
  // CodeSandbox define API accepts a JSON payload via `?json=1&parameters=…`
  // (URL-encoded JSON instead of LZ-string-compressed base64). Using POST
  // form submit so the payload doesn't hit URL-length limits.
  const parameters = {
    files: Object.fromEntries(files.map((f) => [f.path, { content: f.content }])),
    template: 'create-react-app-typescript',
    title,
  };
  return {
    provider: 'codesandbox',
    action: 'https://codesandbox.io/api/v1/sandboxes/define?json=1',
    fields: [['parameters', JSON.stringify(parameters)]],
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
