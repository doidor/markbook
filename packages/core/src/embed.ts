import path from 'node:path';
import fs from 'node:fs/promises';
import { glob } from 'tinyglobby';
import { build as viteBuild } from 'vite';
import { parseMarkdown } from './parse.js';
import { createContext, makeLoadTemplate, type BuildContext } from './build.js';
import type { MarkbookConfig } from './config.js';

interface DiscoveredStory {
  slug: string;
  pageRelPath: string;
  src: string;
  exportName: string;
  absStoryFile: string;
}

export type BundleMode = 'embed' | 'package';
export type BundleIsolation = 'shadow';

export interface BundleEmbedOptions {
  /** If set, bundle only the story with this slug. Otherwise bundles every story. */
  storyId?: string;
  /** `'embed'` (default) or `'package'`. */
  mode?: BundleMode;
  /** Wrap the mount in an open shadow root so host-page CSS doesn't leak in. */
  isolation?: BundleIsolation;
}

export async function bundleEmbed(
  config: MarkbookConfig,
  opts: BundleEmbedOptions = {},
): Promise<void> {
  const ctx = await createContext(config);
  const mode: BundleMode = opts.mode ?? 'embed';
  const isolation = opts.isolation;

  const tmpDir = path.join(ctx.tmpDir, mode);
  const outRoot =
    mode === 'package'
      ? path.join(ctx.outDir, 'packages')
      : path.join(ctx.outDir, 'embed');

  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(outRoot, { recursive: true });

  const stories = await discoverStories(ctx);
  if (stories.length === 0) {
    throw new Error(
      'Markbook bundle: no stories discovered. Add some `:::story` directives first.',
    );
  }

  const targets = opts.storyId
    ? stories.filter((s) => s.slug === opts.storyId)
    : stories;
  if (targets.length === 0) {
    throw new Error(
      `Markbook bundle: no story with id '${opts.storyId}'. Available: ${stories.map((s) => s.slug).join(', ')}`,
    );
  }

  for (const story of targets) {
    if (mode === 'embed') {
      await bundleEmbedOne(ctx, story, tmpDir, outRoot, isolation);
    } else {
      await bundlePackageOne(ctx, story, tmpDir, outRoot, isolation);
    }
  }

  if (mode === 'embed') {
    await fs.writeFile(
      path.join(outRoot, 'index.html'),
      generateSandboxHtml(targets, ctx.siteTitle),
    );
  }

  const summary = `${targets.length} ${targets.length === 1 ? 'story' : 'stories'}`;
  console.log(
    `✓ Bundled ${summary} (${mode}${isolation ? `, isolation=${isolation}` : ''}) → ${path.relative(ctx.root, outRoot)}`,
  );
  if (mode === 'embed') {
    console.log(
      `  Sandbox: ${path.relative(ctx.root, path.join(outRoot, 'index.html'))}`,
    );
  }
}

async function bundleEmbedOne(
  ctx: BuildContext,
  story: DiscoveredStory,
  tmpDir: string,
  outDir: string,
  isolation: BundleIsolation | undefined,
): Promise<void> {
  const entryAbs = path.join(tmpDir, `${story.slug}.entry.ts`);
  const entryCode = generateEmbedEntry(
    story,
    ctx.adapterPackageName,
    ctx.wrapperPath,
    tmpDir,
    isolation,
  );
  await fs.writeFile(entryAbs, entryCode);

  await viteBuild({
    root: ctx.root,
    plugins: ctx.adapterPlugins as never,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    build: {
      lib: {
        entry: entryAbs,
        formats: ['es'],
        fileName: () => `${story.slug}.js`,
      },
      outDir,
      emptyOutDir: false,
      cssCodeSplit: false,
      minify: 'esbuild',
      rollupOptions: {
        external: () => false,
      },
    },
    logLevel: 'warn',
    configFile: false,
  });
}

async function bundlePackageOne(
  ctx: BuildContext,
  story: DiscoveredStory,
  tmpDir: string,
  outRoot: string,
  isolation: BundleIsolation | undefined,
): Promise<void> {
  const peerDeps = ctx.config.adapter.packagePeerDeps ?? [];
  const scope = ctx.config.bundle?.packageScope;
  const version = ctx.config.bundle?.packageVersion ?? '0.0.1';
  const pkgName = scope ? `${scope}/${story.slug}` : story.slug;

  const pkgDir = path.join(outRoot, story.slug);
  await fs.rm(pkgDir, { recursive: true, force: true });
  await fs.mkdir(path.join(pkgDir, 'dist'), { recursive: true });

  const entryAbs = path.join(tmpDir, `${story.slug}.entry.ts`);
  const entryCode = generatePackageEntry(
    story,
    ctx.adapterPackageName,
    ctx.wrapperPath,
    tmpDir,
    isolation,
  );
  await fs.writeFile(entryAbs, entryCode);

  await viteBuild({
    root: ctx.root,
    plugins: ctx.adapterPlugins as never,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    build: {
      lib: {
        entry: entryAbs,
        formats: ['es'],
        fileName: () => 'index.js',
      },
      outDir: path.join(pkgDir, 'dist'),
      emptyOutDir: false,
      cssCodeSplit: false,
      minify: 'esbuild',
      rollupOptions: {
        external: peerDeps,
      },
    },
    logLevel: 'warn',
    configFile: false,
  });

  await fs.writeFile(
    path.join(pkgDir, 'package.json'),
    `${JSON.stringify(buildPackageJson(pkgName, version, peerDeps), null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(pkgDir, 'README.md'),
    generatePackageReadme(pkgName, story),
  );
}

function buildPackageJson(
  name: string,
  version: string,
  peerDeps: string[],
): Record<string, unknown> {
  const peerDependencies: Record<string, string> = {};
  for (const dep of peerDeps) peerDependencies[dep] = '*';
  const out: Record<string, unknown> = {
    name,
    version,
    type: 'module',
    main: './dist/index.js',
    exports: {
      '.': './dist/index.js',
    },
    sideEffects: false,
  };
  if (peerDeps.length > 0) out.peerDependencies = peerDependencies;
  return out;
}

function generatePackageReadme(
  pkgName: string,
  story: DiscoveredStory,
): string {
  return `# ${pkgName}

A portable Markbook story bundled from \`${story.pageRelPath}\` (\`${story.slug}\`).

## Install

\`\`\`bash
npm install ${pkgName}
\`\`\`

## Mount

\`\`\`js
import { mount } from '${pkgName}';

mount(document.getElementById('here'));
\`\`\`

The default export is the story's component / factory. Re-export from \`@markbook/core\` is not bundled — only the story, the user-configured \`wrapper\`, and the adapter \`mount\` are. Framework runtimes (e.g. \`react\`, \`react-dom\`, \`vue\`) are declared as peer dependencies — bring your own.
`;
}

async function discoverStories(ctx: BuildContext): Promise<DiscoveredStory[]> {
  const loadTemplate = makeLoadTemplate(ctx.templateDirs, ctx.root);
  const stories: DiscoveredStory[] = [];
  const mdFiles = await glob('**/*.md', { cwd: ctx.docsDir, absolute: true });
  for (const mdFile of mdFiles.sort()) {
    const source = await fs.readFile(mdFile, 'utf8');
    const fileId = path
      .relative(ctx.docsDir, mdFile)
      .replace(/\.md$/, '')
      .replace(/[\\/]/g, '__');
    const parsed = await parseMarkdown(source, fileId, {
      pageFile: mdFile,
      loadTemplate,
    });
    for (const story of parsed.stories) {
      const absStoryFile = path.resolve(path.dirname(mdFile), story.src);
      const docsRel = path.relative(ctx.docsDir, absStoryFile);
      const derivedSlug = slugify(
        docsRel.replace(/\.stories\.(tsx|ts|jsx|js)$/, ''),
      );
      const slug = story.slug ?? derivedSlug;
      stories.push({
        slug,
        pageRelPath: path.relative(ctx.docsDir, mdFile),
        src: story.src,
        exportName: story.exportName,
        absStoryFile,
      });
    }
  }
  return stories;
}

function slugify(s: string): string {
  return s
    .replace(/[\\/]/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function buildEntryImports(
  story: DiscoveredStory,
  adapterPkg: string,
  wrapperPath: string | undefined,
  entryDir: string,
): { imports: string; storyRef: string; wrapperRef: string | undefined } {
  const lines: string[] = [
    `import { mount as adapterMount } from ${JSON.stringify(adapterPkg)};`,
  ];
  let wrapperRef: string | undefined;
  if (wrapperPath) {
    let rel = path.relative(entryDir, wrapperPath).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    lines.push(`import Wrapper from ${JSON.stringify(rel)};`);
    wrapperRef = 'Wrapper';
  }
  let storyRel = path
    .relative(entryDir, story.absStoryFile)
    .replace(/\\/g, '/');
  if (!storyRel.startsWith('.')) storyRel = `./${storyRel}`;
  if (story.exportName === 'default') {
    lines.push(`import Story from ${JSON.stringify(storyRel)};`);
  } else {
    lines.push(
      `import { ${story.exportName} as Story } from ${JSON.stringify(storyRel)};`,
    );
  }
  return { imports: lines.join('\n'), storyRef: 'Story', wrapperRef };
}

function buildMountOptsLiteral(
  wrapperRef: string | undefined,
  isolation: BundleIsolation | undefined,
): string {
  const fields: string[] = [];
  if (wrapperRef) fields.push(`wrapper: ${wrapperRef}`);
  if (isolation) fields.push(`isolation: ${JSON.stringify(isolation)}`);
  return fields.length > 0 ? `, { ${fields.join(', ')} }` : '';
}

function generateEmbedEntry(
  story: DiscoveredStory,
  adapterPkg: string,
  wrapperPath: string | undefined,
  entryDir: string,
  isolation: BundleIsolation | undefined,
): string {
  const { imports, storyRef, wrapperRef } = buildEntryImports(
    story,
    adapterPkg,
    wrapperPath,
    entryDir,
  );
  const optsArg = buildMountOptsLiteral(wrapperRef, isolation);

  return `${imports}

const SLUG = ${JSON.stringify(story.slug)};
const targets = document.querySelectorAll('[data-markbook-embed="' + SLUG + '"]');
for (const el of targets) {
  adapterMount(el, ${storyRef}${optsArg});
}
`;
}

function generatePackageEntry(
  story: DiscoveredStory,
  adapterPkg: string,
  wrapperPath: string | undefined,
  entryDir: string,
  isolation: BundleIsolation | undefined,
): string {
  const { imports, storyRef, wrapperRef } = buildEntryImports(
    story,
    adapterPkg,
    wrapperPath,
    entryDir,
  );
  const baseOpts = buildMountOptsLiteral(wrapperRef, isolation);

  // Allow callers to override / extend opts (their opts win).
  const optsExpr = baseOpts
    ? `Object.assign({}${baseOpts.replace(/^,\s*/, ', ')}, opts || {})`
    : `opts || {}`;

  return `${imports}

export const story = ${storyRef};

export function mount(el, opts) {
  return adapterMount(el, ${storyRef}, ${optsExpr});
}

export default mount;
`;
}

function generateSandboxHtml(
  stories: DiscoveredStory[],
  siteTitle: string,
): string {
  const cards = stories
    .map(
      (s) => `
  <article class="card">
    <header>
      <code class="slug">${s.slug}</code>
      <span class="src">${s.pageRelPath}</span>
    </header>
    <div class="mount" data-markbook-embed="${s.slug}"></div>
    <script type="module" src="./${s.slug}.js"></script>
  </article>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(siteTitle)} embeds</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --fg: #1a1a1a; --muted: #5b5b66; --border: #e6e6eb; --accent: #4a3aff; --soft: #fafafa; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif; max-width: 920px; margin: 2rem auto; padding: 1rem 1.5rem; color: var(--fg); line-height: 1.55; }
  h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
  p.lede { color: var(--muted); margin: 0 0 2rem; }
  .card { border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin: 0.75rem 0; }
  .card header { display: flex; gap: 0.75rem; align-items: baseline; justify-content: space-between; margin-bottom: 0.75rem; }
  .card header .slug { font-family: ui-monospace, 'SF Mono', monospace; font-size: 0.85rem; color: var(--accent); }
  .card header .src { color: var(--muted); font-size: 0.78rem; }
  .mount { padding: 1.25rem; background: var(--soft); border-radius: 6px; display: flex; align-items: center; justify-content: center; min-height: 60px; }
  code { font-family: ui-monospace, 'SF Mono', monospace; font-size: 0.85em; }
</style>
</head>
<body>
<h1>${escapeHtml(siteTitle)} — embed sandbox</h1>
<p class="lede">Each card below loads one bundled story via <code>&lt;script type="module" src="…"&gt;</code> + a <code>&lt;div data-markbook-embed="…"&gt;</code> placeholder. <strong>No iframe.</strong></p>
${cards}
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
