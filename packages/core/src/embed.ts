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

export interface BundleEmbedOptions {
  /** If set, bundle only the story with this slug. Otherwise bundles every story. */
  storyId?: string;
}

export async function bundleEmbed(
  config: MarkbookConfig,
  opts: BundleEmbedOptions = {},
): Promise<void> {
  const ctx = await createContext(config);
  const tmpDir = path.join(ctx.tmpDir, 'embed');
  const outEmbedDir = path.join(ctx.outDir, 'embed');

  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(outEmbedDir, { recursive: true });

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
    await bundleOne(ctx, story, tmpDir, outEmbedDir);
  }

  await fs.writeFile(
    path.join(outEmbedDir, 'index.html'),
    generateSandboxHtml(targets, ctx.siteTitle),
  );

  console.log(
    `✓ Bundled ${targets.length} ${targets.length === 1 ? 'story' : 'stories'} → ${path.relative(ctx.root, outEmbedDir)}`,
  );
  console.log(
    `  Sandbox: ${path.relative(ctx.root, path.join(outEmbedDir, 'index.html'))}`,
  );
}

async function bundleOne(
  ctx: BuildContext,
  story: DiscoveredStory,
  tmpDir: string,
  outEmbedDir: string,
): Promise<void> {
  const entryAbs = path.join(tmpDir, `${story.slug}.entry.ts`);
  const entryCode = generateEmbedEntry(
    story,
    ctx.adapterPackageName,
    ctx.wrapperPath,
    tmpDir,
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
      outDir: outEmbedDir,
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
      const slug = slugify(
        docsRel.replace(/\.stories\.(tsx|ts|jsx|js)$/, ''),
      );
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

function generateEmbedEntry(
  story: DiscoveredStory,
  adapterPkg: string,
  wrapperPath: string | undefined,
  entryDir: string,
): string {
  const importLines: string[] = [
    `import { mount } from ${JSON.stringify(adapterPkg)};`,
  ];

  if (wrapperPath) {
    let rel = path.relative(entryDir, wrapperPath).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    importLines.push(`import Wrapper from ${JSON.stringify(rel)};`);
  }

  let storyRel = path
    .relative(entryDir, story.absStoryFile)
    .replace(/\\/g, '/');
  if (!storyRel.startsWith('.')) storyRel = `./${storyRel}`;

  if (story.exportName === 'default') {
    importLines.push(`import Story from ${JSON.stringify(storyRel)};`);
  } else {
    importLines.push(
      `import { ${story.exportName} as Story } from ${JSON.stringify(storyRel)};`,
    );
  }

  const wrapperArg = wrapperPath ? ', { wrapper: Wrapper }' : '';

  return `${importLines.join('\n')}

const SLUG = ${JSON.stringify(story.slug)};
const targets = document.querySelectorAll('[data-markbook-embed="' + SLUG + '"]');
for (const el of targets) {
  mount(el, Story${wrapperArg});
}
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
