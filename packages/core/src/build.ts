import path from 'node:path';
import fs from 'node:fs/promises';
import { glob } from 'tinyglobby';
import { build as viteBuild, createServer } from 'vite';
import * as pagefind from 'pagefind';
import chokidar from 'chokidar';
import { parseMarkdown } from './parse.js';
import { extractStoryCode } from './code.js';
import { extractComponentProps } from './props.js';
import type { ParsedPage, StoryRef } from './parse.js';
import type { MarkbookConfig } from './config.js';

interface PageRecord {
  file: string;
  relPath: string;
  htmlRelPath: string;
  entryRelPath: string;
  txtRelPath: string;
  fileId: string;
  groupKey: string | null;
  parsed: ParsedPage;
}

export interface NavItem {
  id: string;
  title: string;
  htmlRelPath: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export interface BuildContext {
  config: MarkbookConfig;
  root: string;
  docsDir: string;
  outDir: string;
  tmpDir: string;
  templateDirs: string[];
  decoratorPaths: string[];
  siteTitle: string;
  siteDescription: string | undefined;
  adapterPackageName: string;
  adapterPlugins: unknown[];
  hasControls: boolean;
  cssPaths: string[];
  userCss: string;
  disableBaseCss: boolean;
}

export function makeLoadTemplate(
  templateDirs: string[],
  root: string,
): (name: string) => Promise<string> {
  return async (name: string) => {
    for (const dir of templateDirs) {
      const candidate = path.join(dir, `${name}.md`);
      try {
        return await fs.readFile(candidate, 'utf8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }
    const searched = templateDirs.map((d) => path.relative(root, d) || d).join(', ');
    throw new Error(`Markbook: template '${name}' not found in: ${searched}`);
  };
}

export async function createContext(config: MarkbookConfig): Promise<BuildContext> {
  const root = path.resolve(config.root ?? process.cwd());
  const docsDir = path.resolve(root, config.docsDir ?? 'docs');
  const outDir = path.resolve(root, config.outDir ?? 'dist');
  const tmpDir = path.resolve(root, '.markbook');
  const siteTitle = config.title ?? 'Markbook';
  const siteDescription = config.description;
  const templateDirs = (() => {
    const raw = config.templatesDir ?? 'templates';
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((d) => path.resolve(root, d));
  })();
  const decoratorPaths = (config.adapter.decoratorModules ?? []).map((m) => path.resolve(root, m));
  const adapterPlugins = config.adapter.vitePlugins ? await config.adapter.vitePlugins() : [];
  const cssPaths = (() => {
    const raw = config.css;
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((p) => path.resolve(root, p));
  })();
  const userCss = await loadUserCss(cssPaths);

  return {
    config,
    root,
    docsDir,
    outDir,
    tmpDir,
    templateDirs,
    decoratorPaths,
    siteTitle,
    siteDescription,
    adapterPackageName: config.adapter.packageName,
    adapterPlugins,
    hasControls: !!config.adapter.hasControls,
    cssPaths,
    userCss,
    disableBaseCss: !!config.disableBaseCss,
  };
}

async function loadUserCss(cssPaths: string[]): Promise<string> {
  if (cssPaths.length === 0) return '';
  const sources: string[] = [];
  for (const p of cssPaths) {
    try {
      sources.push(await fs.readFile(p, 'utf8'));
    } catch (err) {
      throw new Error(`Markbook: failed to read CSS file '${p}' — ${(err as Error).message}`);
    }
  }
  return sources.join('\n');
}

interface WritePagesResult {
  pages: PageRecord[];
  htmlInputs: Record<string, string>;
}

async function writePages(
  ctx: BuildContext,
  opts: { clean: boolean; searchEnabled: boolean },
): Promise<WritePagesResult> {
  if (opts.clean) {
    await fs.rm(ctx.tmpDir, { recursive: true, force: true });
  }
  await fs.mkdir(ctx.tmpDir, { recursive: true });

  const mdFiles = await glob('**/*.md', { cwd: ctx.docsDir, absolute: true });
  if (mdFiles.length === 0) {
    throw new Error(`No markdown files found in ${ctx.docsDir}`);
  }

  const pages: PageRecord[] = [];
  for (const file of mdFiles.sort()) {
    const relPath = path.relative(ctx.docsDir, file);
    const noExt = relPath.replace(/\.md$/, '');
    const htmlRelPath = `${noExt}.html`;
    const entryRelPath = `${noExt}.entry.ts`;
    const txtRelPath = `${noExt}.txt`;
    const fileId = noExt.replace(/[\\/]/g, '__').replace(/[^a-z0-9_]/gi, '_');
    const segments = relPath.split(/[\\/]/);
    const groupKey = segments.length > 1 && segments[0] ? capitalize(segments[0]) : null;
    const source = await fs.readFile(file, 'utf8');
    const parsed = await parseMarkdown(source, fileId, {
      pageFile: file,
      resolveStoryCode: (info) => extractStoryCode(info.absStoryFile, info.exportName),
      resolveProps: (info) =>
        extractComponentProps(info.absComponentFile, info.exportName, ctx.root),
      loadTemplate: makeLoadTemplate(ctx.templateDirs, ctx.root),
    });
    pages.push({
      file,
      relPath,
      htmlRelPath,
      entryRelPath,
      txtRelPath,
      fileId,
      groupKey,
      parsed,
    });
  }

  const nav = buildNav(pages);

  const htmlInputs: Record<string, string> = {};
  for (const page of pages) {
    const htmlAbs = path.join(ctx.tmpDir, page.htmlRelPath);
    const entryAbs = path.join(ctx.tmpDir, page.entryRelPath);
    await fs.mkdir(path.dirname(htmlAbs), { recursive: true });

    const entryCode = generateEntry(
      page.parsed.stories,
      path.dirname(page.file),
      ctx.adapterPackageName,
      path.dirname(entryAbs),
      ctx.decoratorPaths,
      ctx.hasControls,
    );
    let html = generateHtml(
      page,
      nav,
      ctx.siteTitle,
      path.basename(entryAbs),
      opts.searchEnabled,
      ctx.userCss,
      ctx.disableBaseCss,
    );

    if (ctx.config.transformHtml) {
      html = await ctx.config.transformHtml(html, {
        relPath: page.relPath,
        htmlRelPath: page.htmlRelPath,
        title: page.parsed.title,
        frontmatter: page.parsed.frontmatter,
      });
    }

    await fs.writeFile(entryAbs, entryCode);
    await fs.writeFile(htmlAbs, html);
    htmlInputs[page.fileId] = htmlAbs;
  }

  return { pages, htmlInputs };
}

export async function build(config: MarkbookConfig): Promise<void> {
  const ctx = await createContext(config);
  const { pages, htmlInputs } = await writePages(ctx, {
    clean: true,
    searchEnabled: true,
  });

  await viteBuild({
    root: ctx.tmpDir,
    base: './',
    plugins: ctx.adapterPlugins as never,
    css: {
      postcss: ctx.root,
    },
    build: {
      outDir: ctx.outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: htmlInputs,
        onwarn(warning, warn) {
          if (warning.code === 'MISSING_EXPORT') return;
          warn(warning);
        },
      },
    },
    logLevel: 'warn',
    configFile: false,
  });

  await emitLlms(pages, ctx.outDir, ctx.siteTitle, ctx.siteDescription);
  await runPagefind(ctx.outDir);
}

export async function dev(config: MarkbookConfig): Promise<void> {
  const ctx = await createContext(config);
  await writePages(ctx, { clean: true, searchEnabled: false });

  const server = await createServer({
    root: ctx.tmpDir,
    base: '/',
    appType: 'mpa',
    plugins: ctx.adapterPlugins as never,
    css: {
      postcss: ctx.root,
    },
    server: {
      port: config.dev?.port,
      host: config.dev?.host,
      fs: { allow: [ctx.root] },
    },
    logLevel: 'warn',
    configFile: false,
  });

  await server.listen();

  const localUrls = server.resolvedUrls?.local ?? [];
  const networkUrls = server.resolvedUrls?.network ?? [];
  console.log('');
  console.log('  Markbook dev server ready:');
  for (const url of localUrls) console.log(`    ➜  Local:   ${url}`);
  for (const url of networkUrls) console.log(`    ➜  Network: ${url}`);
  console.log('');
  console.log('  Watching markdown + templates for changes (Ctrl-C to stop)');
  console.log('');

  const watchPaths = [ctx.docsDir, ...ctx.templateDirs, ...ctx.cssPaths];
  const watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 },
  });

  let regenerating = false;
  const onChange = async (event: 'change' | 'add' | 'unlink', file: string) => {
    const isMd = file.endsWith('.md');
    const isCss = ctx.cssPaths.includes(path.resolve(file));
    if (!isMd && !isCss) return;
    if (regenerating) return;
    regenerating = true;
    try {
      const t0 = Date.now();
      if (isCss) ctx.userCss = await loadUserCss(ctx.cssPaths);
      await writePages(ctx, { clean: false, searchEnabled: false });
      const dt = Date.now() - t0;
      console.log(`[markbook] ${event} ${path.relative(ctx.root, file)} — regenerated in ${dt}ms`);
      server.ws.send({ type: 'full-reload', path: '*' });
    } catch (err) {
      console.error('[markbook] regeneration failed:', err);
      server.ws.send({
        type: 'error',
        err: {
          message: (err as Error).message,
          stack: (err as Error).stack ?? '',
        },
      });
    } finally {
      regenerating = false;
    }
  };
  watcher.on('change', (file) => onChange('change', file));
  watcher.on('add', (file) => onChange('add', file));
  watcher.on('unlink', (file) => onChange('unlink', file));

  const shutdown = async () => {
    await watcher.close();
    await server.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

async function runPagefind(outDir: string): Promise<void> {
  const create = await pagefind.createIndex({});
  const errs = (create as { errors?: string[] }).errors;
  if (errs && errs.length > 0) {
    throw new Error(`Pagefind createIndex: ${errs.join(', ')}`);
  }
  const index = (create as { index?: unknown }).index;
  if (!index) throw new Error('Pagefind: failed to create index');

  const idx = index as {
    addDirectory: (opts: { path: string }) => Promise<{ errors?: string[] }>;
    writeFiles: (opts: { outputPath: string }) => Promise<{ errors?: string[] }>;
  };

  const addRes = await idx.addDirectory({ path: outDir });
  if (addRes.errors && addRes.errors.length > 0) {
    throw new Error(`Pagefind addDirectory: ${addRes.errors.join(', ')}`);
  }
  const writeRes = await idx.writeFiles({
    outputPath: path.join(outDir, 'pagefind'),
  });
  if (writeRes.errors && writeRes.errors.length > 0) {
    throw new Error(`Pagefind writeFiles: ${writeRes.errors.join(', ')}`);
  }
}

function buildNav(pages: PageRecord[]): NavGroup[] {
  const groupMap = new Map<string | null, NavItem[]>();
  for (const p of pages) {
    if (!groupMap.has(p.groupKey)) groupMap.set(p.groupKey, []);
    groupMap.get(p.groupKey)!.push({
      id: p.fileId,
      title: p.parsed.title,
      htmlRelPath: p.htmlRelPath,
    });
  }
  const groups: NavGroup[] = [];
  if (groupMap.has(null)) {
    groups.push({ label: null, items: sortIndexFirst(groupMap.get(null)!) });
  }
  const named = [...groupMap.entries()]
    .filter(([k]) => k !== null)
    .sort(([a], [b]) => (a as string).localeCompare(b as string));
  for (const [k, v] of named) {
    groups.push({ label: k as string, items: sortIndexFirst(v) });
  }
  return groups;
}

export function sortIndexFirst(items: NavItem[]): NavItem[] {
  return items.slice().sort((a, b) => {
    const aIdx = isIndexHref(a.htmlRelPath);
    const bIdx = isIndexHref(b.htmlRelPath);
    if (aIdx && !bIdx) return -1;
    if (!aIdx && bIdx) return 1;
    return 0;
  });
}

export function isIndexHref(href: string): boolean {
  return href === 'index.html' || href.endsWith('/index.html');
}

async function emitLlms(
  pages: PageRecord[],
  outDir: string,
  siteTitle: string,
  siteDescription: string | undefined,
): Promise<void> {
  const llmsDir = path.join(outDir, 'llms');
  for (const page of pages) {
    const txtAbs = path.join(llmsDir, page.txtRelPath);
    await fs.mkdir(path.dirname(txtAbs), { recursive: true });
    const startsWithH1 = /^#\s/.test(page.parsed.plainMarkdown);
    const txtContent = startsWithH1
      ? page.parsed.plainMarkdown
      : `# ${page.parsed.title}\n\n${page.parsed.plainMarkdown}`;
    await fs.writeFile(txtAbs, `${txtContent}\n`);
  }

  const lines: string[] = [];
  lines.push(`# ${siteTitle}`);
  lines.push('');
  lines.push(
    '> **Note:** This is a summary overview using the LLMs.txt format (https://llmstxt.org/). Each section links to its full documentation file in plain text format.',
  );
  lines.push('');
  if (siteDescription) {
    lines.push(siteDescription);
    lines.push('');
  }

  for (const page of pages) {
    const linkText = formatLinkText(page);
    const url = `./llms/${page.txtRelPath.replace(/\\/g, '/')}`;
    const desc =
      typeof page.parsed.frontmatter.description === 'string'
        ? `: ${page.parsed.frontmatter.description}`
        : '';
    lines.push(`- [${linkText}](${url})${desc}`);
  }

  await fs.writeFile(path.join(outDir, 'llms.txt'), `${lines.join('\n')}\n`);
}

function formatLinkText(page: PageRecord): string {
  const segments = page.relPath.replace(/\.md$/, '').split(/[\\/]/);
  const last = segments[segments.length - 1];
  if (segments.length === 1 && last && last.toLowerCase() === 'index') {
    return page.parsed.title;
  }
  const dirSegments = segments.slice(0, -1).map(capitalize);
  const dir = dirSegments.join('/');
  return dir ? `${dir}/${page.parsed.title}` : page.parsed.title;
}

export function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function generateEntry(
  stories: StoryRef[],
  pageDir: string,
  adapterPkg: string,
  entryDir: string,
  decoratorPaths: string[],
  hasControls: boolean,
): string {
  if (stories.length === 0) return 'export {};\n';

  const importLines: string[] = [];
  const decoratorRefs: string[] = [];

  importLines.push(
    hasControls
      ? `import { mount, setupControls } from ${JSON.stringify(adapterPkg)};`
      : `import { mount } from ${JSON.stringify(adapterPkg)};`,
  );

  decoratorPaths.forEach((p, i) => {
    let rel = path.relative(entryDir, p).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    importLines.push(`import Decorator${i} from ${JSON.stringify(rel)};`);
    decoratorRefs.push(`Decorator${i}`);
  });

  stories.forEach((s, i) => {
    const abs = path.resolve(pageDir, s.src);
    let rel = path.relative(entryDir, abs).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    importLines.push(`import * as story_${i}_mod from ${JSON.stringify(rel)};`);
  });

  const setups = stories.map((s, i) => {
    const exportRef =
      s.exportName === 'default'
        ? `story_${i}_mod.default`
        : `story_${i}_mod[${JSON.stringify(s.exportName)}]`;
    const decoratorsField =
      decoratorRefs.length > 0 ? `decorators: [${decoratorRefs.join(', ')}], ` : '';
    return `
const story_${i} = ${exportRef};
const args_${i} = story_${i}_mod.args ? { ...story_${i}_mod.args } : undefined;
const argTypes_${i} = story_${i}_mod.argTypes;
const params_${i} = story_${i}_mod.parameters;
const el_${i} = document.querySelector('[data-markbook-story="${s.id}"]');
${hasControls ? `const ctrl_${i} = document.querySelector('[data-markbook-controls="${s.id}"]');` : ''}
function render_${i}() {
  mount(el_${i}, story_${i}, { ${decoratorsField}args: args_${i}, parameters: params_${i} });
}
render_${i}();
${
  hasControls
    ? `if (args_${i} && ctrl_${i}) {
  setupControls(ctrl_${i}, args_${i}, argTypes_${i}, render_${i});
}`
    : ''
}`;
  });

  return `${importLines.join('\n')}\n${setups.join('\n')}\n`;
}

function generateHtml(
  page: PageRecord,
  nav: NavGroup[],
  siteTitle: string,
  entryBasename: string,
  searchEnabled: boolean,
  userCss: string,
  disableBaseCss: boolean,
): string {
  const fromDir = path.dirname(page.htmlRelPath);

  const resolveHref = (target: string): string => {
    let rel = path.relative(fromDir, target).replace(/\\/g, '/');
    if (rel === '') rel = path.basename(target);
    if (!rel.startsWith('.') && !rel.startsWith('/')) rel = `./${rel}`;
    return rel;
  };

  const homeItem = nav.find((g) => g.label === null)?.items[0];
  const homeHref = homeItem ? resolveHref(homeItem.htmlRelPath) : resolveHref('index.html');

  const pagefindBase = (() => {
    let rel = path.relative(fromDir, 'pagefind').replace(/\\/g, '/');
    if (rel === '') rel = 'pagefind';
    if (!rel.startsWith('.') && !rel.startsWith('/')) rel = `./${rel}`;
    return rel;
  })();

  const navHtml = nav
    .map((group) => {
      const itemsHtml = group.items
        .map((n) => {
          const href = resolveHref(n.htmlRelPath);
          const active = n.id === page.fileId;
          return `<li><a href="${href}"${active ? ' class="active" aria-current="page"' : ''}>${escapeHtml(n.title)}</a></li>`;
        })
        .join('');
      const heading = group.label ? `<h2>${escapeHtml(group.label)}</h2>` : '';
      return `<div class="markbook-nav-group">${heading}<ul>${itemsHtml}</ul></div>`;
    })
    .join('');

  const tocItems = page.parsed.headings.filter((h) => h.level === 2 || h.level === 3);
  const tocHtml = tocItems
    .map((h) => `<li class="toc-h${h.level}"><a href="#${h.slug}">${escapeHtml(h.text)}</a></li>`)
    .join('');
  const tocBlock =
    tocItems.length > 0
      ? `<aside class="markbook-toc"><h3>On this page</h3><ul>${tocHtml}</ul></aside>`
      : '';
  const shellClass = tocItems.length > 0 ? 'markbook-shell' : 'markbook-shell no-toc';

  const pagefindLink = searchEnabled
    ? `<link href="${pagefindBase}/pagefind-ui.css" rel="stylesheet">`
    : '';
  const searchSlot = searchEnabled
    ? '<div id="markbook-search-ui" class="markbook-search-ui"></div>'
    : '';
  const pagefindScripts = searchEnabled
    ? `<script src="${pagefindBase}/pagefind-ui.js"></script>
<script>
  window.addEventListener('DOMContentLoaded', () => {
    if (typeof PagefindUI !== 'undefined') {
      new PagefindUI({ element: '#markbook-search-ui', showSubResults: true });
    }
  });
</script>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(page.parsed.title)} — ${escapeHtml(siteTitle)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${THEME_BOOT_SCRIPT}</script>
${pagefindLink}
${disableBaseCss ? '' : `<style>${BASE_CSS}</style>`}
${userCss ? `<style data-markbook-user-css>${userCss}</style>` : ''}
</head>
<body>
<header class="markbook-header">
  <a class="markbook-brand" href="${homeHref}"><span class="markbook-logo" aria-hidden>📘</span> ${escapeHtml(siteTitle)}</a>
  ${searchSlot}
  <button class="markbook-theme-toggle" type="button" data-markbook-theme-toggle aria-label="Toggle theme"><span class="markbook-icon-sun" aria-hidden>☀</span><span class="markbook-icon-moon" aria-hidden>☾</span></button>
</header>
<div class="${shellClass}">
  <aside class="markbook-sidebar">
    <nav class="markbook-nav" aria-label="Site">${navHtml}</nav>
  </aside>
  <main class="markbook-main">
    <article class="markbook-content" data-pagefind-body>
${page.parsed.html}
    </article>
  </main>
  ${tocBlock}
</div>
${pagefindScripts}
<script type="module" src="./${entryBasename}"></script>
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

/**
 * Inline IIFE: read the saved theme from localStorage (or the OS preference on
 * first visit), apply it to <html data-theme=…> before paint, and delegate
 * clicks on the theme toggle button to flip it.
 */
const THEME_BOOT_SCRIPT = `(function(){var s;try{s=localStorage.getItem('markbook-theme')}catch(e){}var t=s==='dark'||s==='light'?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-markbook-theme-toggle]');if(!b)return;var c=document.documentElement.dataset.theme;var n=c==='dark'?'light':'dark';document.documentElement.dataset.theme=n;try{localStorage.setItem('markbook-theme',n)}catch(e){}});})();`;

const BASE_CSS = `
:root {
  --mb-bg: #ffffff;
  --mb-fg: #1a1a1a;
  --mb-fg-muted: #5b5b66;
  --mb-border: #e6e6eb;
  --mb-bg-elev: #f7f7f9;
  --mb-bg-soft: #fafafa;
  --mb-accent: #6c5ce7;
  --mb-accent-fg: #ffffff;
  --mb-link: #4a3aff;
  --mb-code-bg: #f6f6fa;
  --mb-radius: 6px;
  --mb-font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --mb-font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  --mb-content-width: 720px;
  --mb-sidebar-width: 240px;
  --mb-toc-width: 200px;
  --mb-header-height: 56px;
  color-scheme: light;
}
[data-theme="dark"] {
  --mb-bg: #0e0e12;
  --mb-fg: #e6e6eb;
  --mb-fg-muted: #94949e;
  --mb-border: #2a2a32;
  --mb-bg-elev: #1a1a22;
  --mb-bg-soft: #16161c;
  --mb-accent: #8b7eff;
  --mb-accent-fg: #ffffff;
  --mb-link: #b6acff;
  --mb-code-bg: #1a1a22;
  color-scheme: dark;
}
*,*::before,*::after { box-sizing: border-box; }
html, body {
  margin: 0;
  background: var(--mb-bg);
  color: var(--mb-fg);
  font-family: var(--mb-font-sans);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--mb-link); text-decoration: none; }
a:hover { text-decoration: underline; }
.markbook-header {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 1rem;
  height: var(--mb-header-height);
  padding: 0 1.5rem;
  background: var(--mb-bg);
  border-bottom: 1px solid var(--mb-border);
}
.markbook-brand {
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--mb-fg);
  display: inline-flex; align-items: center; gap: 0.5rem;
}
.markbook-brand:hover { text-decoration: none; }
.markbook-logo { font-size: 1.2rem; }
.markbook-theme-toggle {
  background: transparent;
  border: 1px solid var(--mb-border);
  border-radius: var(--mb-radius);
  width: 32px;
  height: 32px;
  cursor: pointer;
  color: var(--mb-fg-muted);
  font-size: 0.95rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: inherit;
  flex-shrink: 0;
}
.markbook-theme-toggle:hover {
  color: var(--mb-fg);
  background: var(--mb-bg-elev);
}
.markbook-theme-toggle .markbook-icon-sun,
.markbook-theme-toggle .markbook-icon-moon { display: none; }
[data-theme="dark"] .markbook-theme-toggle .markbook-icon-sun { display: inline; }
:root:not([data-theme="dark"]) .markbook-theme-toggle .markbook-icon-moon { display: inline; }
.markbook-content .shiki,
.markbook-content .shiki span {
  color: var(--shiki-light);
  background-color: var(--shiki-light-bg);
}
[data-theme="dark"] .markbook-content .shiki,
[data-theme="dark"] .markbook-content .shiki span {
  color: var(--shiki-dark);
  background-color: var(--shiki-dark-bg);
}
.markbook-search-ui {
  position: relative;
  width: 360px;
  max-width: 50vw;
  margin-left: auto;
  --pagefind-ui-scale: 1;
  --pagefind-ui-primary: var(--mb-accent);
  --pagefind-ui-text: var(--mb-fg);
  --pagefind-ui-background: var(--mb-bg);
  --pagefind-ui-border: var(--mb-border);
  --pagefind-ui-tag: var(--mb-bg-elev);
  --pagefind-ui-border-width: 1px;
  --pagefind-ui-border-radius: var(--mb-radius);
  --pagefind-ui-font: var(--mb-font-sans);
}
.markbook-search-ui .pagefind-ui__search-input {
  height: 36px;
  padding: 0 36px 0 32px;
  font-size: 0.875rem;
  font-weight: 400;
  background: var(--mb-bg-elev);
  color: var(--mb-fg);
  border-color: var(--mb-border);
}
.markbook-search-ui .pagefind-ui__form::before {
  width: 14px;
  height: 14px;
  top: 11px;
  left: 11px;
  opacity: 0.5;
}
.markbook-search-ui .pagefind-ui__search-clear {
  height: 30px;
  top: 3px;
  right: 3px;
  padding: 0 0.6rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--mb-fg-muted);
  background: transparent;
  border-radius: 4px;
}
.markbook-search-ui .pagefind-ui__search-clear:hover {
  color: var(--mb-fg);
  background: var(--mb-bg-elev);
}
.markbook-search-ui .pagefind-ui__drawer {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: auto;
  width: 480px;
  max-width: min(calc(100vw - 3rem), 600px);
  max-height: 70vh;
  overflow-y: auto;
  background: var(--mb-bg);
  border: 1px solid var(--mb-border);
  border-radius: var(--mb-radius);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  padding: 0.25rem 0.5rem;
  margin: 0;
  z-index: 20;
  gap: 0;
  flex-direction: column;
}
.markbook-search-ui .pagefind-ui__results-area {
  min-width: 0;
  margin-top: 0;
}
.markbook-search-ui .pagefind-ui__message {
  height: auto;
  padding: 0.5rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--mb-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}
.markbook-search-ui .pagefind-ui__results { padding: 0; }
.markbook-search-ui .pagefind-ui__result {
  padding: 0.6rem 0.5rem;
  border-top: 1px solid var(--mb-border);
  gap: 0;
}
.markbook-search-ui .pagefind-ui__result:last-of-type { border-bottom: none; }
.markbook-search-ui .pagefind-ui__result-thumb { display: none; }
.markbook-search-ui .pagefind-ui__result-inner {
  flex: 1;
  margin-top: 0;
  gap: 0;
}
.markbook-search-ui .pagefind-ui__result-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 0.2rem;
}
.markbook-search-ui .pagefind-ui__result-excerpt {
  font-size: 0.8rem;
  color: var(--mb-fg-muted);
  line-height: 1.5;
  min-width: 0;
  margin-top: 0;
}
.markbook-search-ui .pagefind-ui__result-link {
  color: var(--mb-fg);
  text-decoration: none;
}
.markbook-search-ui .pagefind-ui__result-link:hover { color: var(--mb-link); }
.markbook-search-ui .pagefind-ui__result-nested {
  padding-left: 0.875rem;
  padding-top: 0.4rem;
}
.markbook-search-ui .pagefind-ui__result-nested .pagefind-ui__result-link::before {
  font-size: 0.85em;
  opacity: 0.5;
}
.markbook-search-ui mark {
  background: color-mix(in srgb, var(--mb-accent) 22%, transparent);
  color: var(--mb-fg);
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 500;
}
.markbook-search-ui .pagefind-ui__button {
  height: 32px;
  padding: 0 1rem;
  font-size: 0.85rem;
  margin: 0.5rem 0;
  font-weight: 500;
  background: var(--mb-bg-elev);
  border-color: var(--mb-border);
  color: var(--mb-fg);
}
.markbook-search-ui .pagefind-ui__button:hover {
  background: var(--mb-border);
  border-color: var(--mb-border);
  color: var(--mb-fg);
}
.markbook-shell {
  display: grid;
  grid-template-columns: var(--mb-sidebar-width) 1fr var(--mb-toc-width);
  gap: 1.5rem;
  max-width: 1320px;
  margin: 0 auto;
  padding: 1.5rem;
}
.markbook-shell.no-toc { grid-template-columns: var(--mb-sidebar-width) 1fr; }
.markbook-sidebar {
  position: sticky;
  top: calc(var(--mb-header-height) + 1.5rem);
  align-self: start;
  max-height: calc(100vh - var(--mb-header-height) - 3rem);
  overflow-y: auto;
}
.markbook-nav-group + .markbook-nav-group { margin-top: 1rem; }
.markbook-nav-group h2 {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--mb-fg-muted);
  margin: 0 0 0.5rem;
  padding-left: 0.5rem;
}
.markbook-nav-group ul { list-style: none; padding: 0; margin: 0; }
.markbook-nav-group li a {
  display: block;
  padding: 0.4rem 0.65rem;
  font-size: 0.9rem;
  color: var(--mb-fg);
  border-radius: var(--mb-radius);
}
.markbook-nav-group li a:hover { background: var(--mb-bg-elev); text-decoration: none; }
.markbook-nav-group li a.active { background: var(--mb-accent); color: var(--mb-accent-fg); }
.markbook-nav-group li a.active:hover { text-decoration: none; }
.markbook-main { min-width: 0; }
.markbook-content { max-width: var(--mb-content-width); }
.markbook-content > *:first-child { margin-top: 0; }
.markbook-content > h1 + p {
  font-size: 1.05rem;
  color: var(--mb-fg-muted);
  margin-top: 0;
  margin-bottom: 1.5rem;
}
.markbook-content h1 {
  font-size: 2.25rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  line-height: 1.15;
}
.markbook-content h2 {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 2rem 0 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--mb-border);
  scroll-margin-top: 80px;
}
.markbook-content h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1.25rem 0 0.5rem;
  scroll-margin-top: 80px;
}
.markbook-content p { margin: 0.75rem 0; }
.markbook-content code {
  font-family: var(--mb-font-mono);
  font-size: 0.85em;
  background: var(--mb-code-bg);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}
.markbook-content pre {
  margin: 0;
  padding: 0;
  background: transparent;
  font-size: 0.85rem;
  line-height: 1.55;
}
.markbook-content pre code { background: transparent; padding: 0; }
.markbook-story-block { margin: 1rem 0; }
.markbook-story {
  padding: 2rem;
  border: 1px solid var(--mb-border);
  border-radius: var(--mb-radius) var(--mb-radius) 0 0;
  background: var(--mb-bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
}
.markbook-story.markbook-story--centered {
  align-items: center;
  justify-content: center;
}
.markbook-story.markbook-story--padded { padding: 3rem 2rem; }
.markbook-story.markbook-story--fullscreen {
  padding: 0;
  min-height: 360px;
  align-items: stretch;
  justify-content: stretch;
}
.markbook-controls {
  border-left: 1px solid var(--mb-border);
  border-right: 1px solid var(--mb-border);
  background: var(--mb-bg);
  padding: 0.75rem 1rem;
  display: grid;
  grid-template-columns: minmax(80px, max-content) 1fr;
  gap: 0.5rem 0.85rem;
  font-size: 0.85rem;
}
.markbook-controls:empty { display: none; }
.markbook-control { display: contents; }
.markbook-control label {
  font-family: var(--mb-font-mono);
  font-size: 0.78rem;
  color: var(--mb-fg-muted);
  align-self: center;
  white-space: nowrap;
}
.markbook-control input[type="text"],
.markbook-control input[type="number"],
.markbook-control select {
  font-family: var(--mb-font-sans);
  font-size: 0.85rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--mb-border);
  border-radius: 4px;
  background: var(--mb-bg-elev);
  color: var(--mb-fg);
  width: 100%;
}
.markbook-control input[type="checkbox"] {
  align-self: center;
  width: 14px;
  height: 14px;
  margin: 0;
  justify-self: start;
}
.markbook-code {
  border: 1px solid var(--mb-border);
  border-top: none;
  border-radius: 0 0 var(--mb-radius) var(--mb-radius);
  background: var(--mb-bg);
}
.markbook-code summary {
  cursor: pointer;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  color: var(--mb-fg-muted);
  user-select: none;
}
.markbook-code summary:hover { color: var(--mb-fg); }
.markbook-code[open] summary { border-bottom: 1px solid var(--mb-border); }
.markbook-code pre { padding: 1rem; margin: 0; overflow-x: auto; }
.markbook-props {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.875rem;
  border: 1px solid var(--mb-border);
  border-radius: var(--mb-radius);
  overflow: hidden;
}
.markbook-props th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  background: var(--mb-bg-elev);
  border-bottom: 1px solid var(--mb-border);
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--mb-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.markbook-props td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--mb-border);
  vertical-align: top;
}
.markbook-props tr:last-child td { border-bottom: none; }
.markbook-props code { font-size: 0.85em; word-break: break-word; }
.markbook-required { color: #d23; font-weight: 700; margin-left: 2px; }
.markbook-toc {
  position: sticky;
  top: calc(var(--mb-header-height) + 1.5rem);
  align-self: start;
  max-height: calc(100vh - var(--mb-header-height) - 3rem);
  overflow-y: auto;
  font-size: 0.85rem;
}
.markbook-toc h3 {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--mb-fg-muted);
  margin: 0 0 0.5rem;
}
.markbook-toc ul { list-style: none; padding: 0; margin: 0; }
.markbook-toc li a {
  display: block;
  padding: 0.25rem 0.5rem;
  color: var(--mb-fg-muted);
  font-size: 0.85rem;
  border-radius: 4px;
}
.markbook-toc li a:hover { color: var(--mb-fg); background: var(--mb-bg-elev); text-decoration: none; }
.markbook-toc li.toc-h3 a { padding-left: 1.25rem; font-size: 0.8rem; }
@media (max-width: 1100px) {
  .markbook-shell { grid-template-columns: var(--mb-sidebar-width) 1fr; }
  .markbook-toc { display: none; }
}
@media (max-width: 700px) {
  .markbook-shell { grid-template-columns: 1fr; padding: 1rem; }
  .markbook-sidebar { display: none; }
}
`;
