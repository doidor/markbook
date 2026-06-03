import path from 'node:path';
import fs from 'node:fs/promises';
import { glob } from 'tinyglobby';
import { build as viteBuild, createServer } from 'vite';
import * as pagefind from 'pagefind';
import chokidar from 'chokidar';
import { parseMarkdown } from './parse.js';
import { extractStoryCode, invalidateCodeCache } from './code.js';
import { discoverStoryExports, invalidateExportsCache } from './exports.js';
import { extractComponentProps } from './props.js';
import { buildPlaygroundDescriptors } from './playground.js';
import { resolveInlinedSources } from './inline-sources.js';
import { isPathLikeSpec, resolveSpec } from './resolve.js';
import { staticAdapter } from './config.js';
import { applyHtmlLayout, type HtmlLayoutSubstitutions } from './template.js';
import type { ParsedPage, StoryRef } from './parse.js';
import type { MarkbookConfig, MarkbookAdapter, PlaygroundConfig } from './config.js';

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
  /**
   * Absolute path to the directory Markbook reads markdown content from.
   * Resolved from `config.contentDir` (preferred) or `config.docsDir`
   * (legacy alias). Kept named `docsDir` on the context for internal
   * backward compatibility — the public-facing config now uses `contentDir`.
   */
  docsDir: string;
  outDir: string;
  tmpDir: string;
  templateDirs: string[];
  /**
   * Absolute paths of HTML layout directories, searched in order for
   * `<dir>/<name>.html` when a page (or `config.layout`) names a layout.
   */
  layoutDirs: string[];
  /** Default HTML layout name applied to every page unless overridden. */
  defaultLayout: string | null;
  decoratorPaths: string[];
  /**
   * Site-wide title from `MarkbookConfig.title`. When `null`, each page's
   * own `parsed.title` (from frontmatter or first H1) is used in the
   * header brand and `<title>` tag — useful for markdown-only sites where
   * the page IS the site.
   */
  siteTitle: string | null;
  siteDescription: string | undefined;
  adapter: MarkbookAdapter;
  adapterPackageName: string;
  adapterPlugins: unknown[];
  hasControls: boolean;
  cssPaths: string[];
  userCss: string;
  disableBaseCss: boolean;
  /** Resolved playground configuration. `undefined` when disabled or omitted. */
  playground: PlaygroundConfig | undefined;
  /** Whether to render "View as Markdown" / "Copy as Markdown" buttons on every page. */
  llmsButtons: boolean;
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

/**
 * Build an HTML-layout loader. Resolves `<name>.html` against each entry
 * in `layoutDirs`, first match wins. Throws a clear error if no candidate
 * exists — silent fallback to the built-in shell would make typos
 * indistinguishable from "no layout configured".
 */
export function makeLoadHtmlLayout(
  layoutDirs: string[],
  root: string,
): (name: string) => Promise<string> {
  return async (name: string) => {
    for (const dir of layoutDirs) {
      const candidate = path.join(dir, `${name}.html`);
      try {
        return await fs.readFile(candidate, 'utf8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }
    const searched =
      layoutDirs.length > 0
        ? layoutDirs.map((d) => path.relative(root, d) || d).join(', ')
        : '(no layoutsDir configured)';
    throw new Error(
      `Markbook: HTML layout '${name}' not found in: ${searched}. ` +
        `Create '${name}.html' in a layouts directory or set layoutsDir in markbook.config.ts.`,
    );
  };
}

export async function createContext(config: MarkbookConfig): Promise<BuildContext> {
  const root = path.resolve(config.root ?? process.cwd());
  if (config.contentDir != null && config.docsDir != null) {
    throw new Error(
      'Markbook: both `contentDir` and `docsDir` are set in markbook.config.ts. ' +
        '`docsDir` is the legacy alias for `contentDir` — pick one. (Prefer `contentDir`.)',
    );
  }
  const docsDir = path.resolve(root, config.contentDir ?? config.docsDir ?? 'docs');
  const outDir = path.resolve(root, config.outDir ?? 'dist');
  const tmpDir = path.resolve(root, '.markbook');
  const siteTitle = config.title ?? null;
  const siteDescription = config.description;
  const templateDirs = (() => {
    const raw = config.templatesDir ?? 'templates';
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((d) => path.resolve(root, d));
  })();
  const layoutDirs = (() => {
    const raw = config.layoutsDir ?? 'layouts';
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((d) => path.resolve(root, d));
  })();
  const defaultLayout = config.layout ?? null;
  const adapter = config.adapter ?? staticAdapter();
  const decoratorPaths = (adapter.decoratorModules ?? []).map((m) => {
    const resolved = resolveSpec(m, root);
    if (!resolved) {
      throw new Error(
        `Markbook: decorator module '${m}' could not be resolved from ${root}. ` +
          `Use a relative path or install the bare-specifier package.`,
      );
    }
    return resolved;
  });
  const adapterPlugins = adapter.vitePlugins ? await adapter.vitePlugins() : [];
  const cssPaths = (() => {
    const raw = config.css;
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((p) => {
      const resolved = resolveSpec(p, root);
      if (!resolved) {
        throw new Error(
          `Markbook: css file '${p}' could not be resolved from ${root}. ` +
            `Use a relative path or install the bare-specifier package.`,
        );
      }
      return resolved;
    });
  })();
  const userCss = await loadUserCss(cssPaths);

  return {
    config,
    root,
    docsDir,
    outDir,
    tmpDir,
    templateDirs,
    layoutDirs,
    defaultLayout,
    decoratorPaths,
    siteTitle,
    siteDescription,
    adapter,
    adapterPackageName: adapter.packageName,
    adapterPlugins,
    hasControls: !!adapter.hasControls,
    cssPaths,
    userCss,
    disableBaseCss: !!config.disableBaseCss,
    playground: config.playground === false || !config.playground ? undefined : config.playground,
    llmsButtons: config.llmsButtons !== false,
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
  /** Absolute paths of every story file referenced by any directive. Used by `dev` for HMR watching. */
  storyFiles: string[];
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
      resolveStoryExports: (absStoryFile) => discoverStoryExports(absStoryFile),
      resolveProps: (info) =>
        extractComponentProps(info.absComponentFile, info.exportName, ctx.root),
      loadTemplate: makeLoadTemplate(ctx.templateDirs, ctx.root),
      renderStoryExtras: ctx.playground
        ? (story) => renderPlaygroundButtons(story, ctx.playground!, file, ctx.root)
        : undefined,
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

  // Static adapter + stories is a misconfiguration we surface here so the
  // user gets a single clear error instead of an obscure Vite failure.
  if (ctx.adapter.isStatic) {
    const offending = pages.filter((p) => p.parsed.stories.length > 0);
    if (offending.length > 0) {
      const sample = offending
        .slice(0, 3)
        .map(
          (p) =>
            `  - ${p.relPath} (${p.parsed.stories.length} ${p.parsed.stories.length === 1 ? 'story' : 'stories'})`,
        )
        .join('\n');
      throw new Error(
        `Markbook: ${offending.length} page${offending.length === 1 ? '' : 's'} ` +
          `${offending.length === 1 ? 'uses' : 'use'} \`:::story\` or \`:::stories\` directives but no adapter is configured.\n${sample}\n` +
          `Add \`adapter: reactAdapter()\` (or vueAdapter / wcAdapter) to markbook.config.ts.`,
      );
    }
  }

  const htmlInputs: Record<string, string> = {};
  const loadHtmlLayout = makeLoadHtmlLayout(ctx.layoutDirs, ctx.root);
  for (const page of pages) {
    const htmlAbs = path.join(ctx.tmpDir, page.htmlRelPath);
    const entryAbs = path.join(ctx.tmpDir, page.entryRelPath);
    await fs.mkdir(path.dirname(htmlAbs), { recursive: true });

    // Zero-story pages don't need an entry script at all — pure markdown.
    // Skip writing the entry file AND omit the module script from the HTML.
    const hasStories = page.parsed.stories.length > 0;
    if (hasStories) {
      const entryCode = generateEntry(
        page.parsed.stories,
        path.dirname(page.file),
        ctx.adapterPackageName,
        path.dirname(entryAbs),
        ctx.decoratorPaths,
        ctx.hasControls,
      );
      await fs.writeFile(entryAbs, entryCode);
    }

    let html: string;
    const layoutName = resolvePageLayout(page, ctx.defaultLayout);
    const prc = buildPageRenderContext(
      page,
      nav,
      ctx.siteTitle,
      hasStories ? path.basename(entryAbs) : null,
      opts.searchEnabled,
      ctx.userCss,
      ctx.disableBaseCss,
      ctx.llmsButtons,
    );
    if (layoutName) {
      const layoutBody = await loadHtmlLayout(layoutName);
      html = renderLayout(prc, layoutName, layoutBody);
    } else {
      html = renderBuiltinShell(prc);
    }

    if (ctx.config.transformHtml) {
      html = await ctx.config.transformHtml(html, {
        relPath: page.relPath,
        htmlRelPath: page.htmlRelPath,
        title: page.parsed.title,
        frontmatter: page.parsed.frontmatter,
      });
    }

    await fs.writeFile(htmlAbs, html);
    htmlInputs[page.fileId] = htmlAbs;
  }

  // Always write per-page `llms/<path>.txt` mirrors next to the HTML in
  // tmpDir so the "View as Markdown" / "Copy as Markdown" buttons work in
  // both build and dev modes. `emitLlms` (called from `build`) re-writes
  // them to outDir after Vite copies tmpDir → outDir, plus generates the
  // top-level llms.txt index.
  await emitPerPageLlmsTxt(pages, ctx.tmpDir);

  const storyFiles = collectStoryFiles(pages);
  return { pages, htmlInputs, storyFiles };
}

function collectStoryFiles(pages: PageRecord[]): string[] {
  const set = new Set<string>();
  for (const page of pages) {
    const pageDir = path.dirname(page.file);
    for (const story of page.parsed.stories) {
      set.add(path.resolve(pageDir, story.src));
    }
  }
  return [...set];
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
  const initial = await writePages(ctx, { clean: true, searchEnabled: false });

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
  console.log(
    '  Watching markdown, templates, layouts, CSS, and story files for changes (Ctrl-C to stop)',
  );
  console.log('');

  const watcher = chokidar.watch(
    [ctx.docsDir, ...ctx.templateDirs, ...ctx.layoutDirs, ...ctx.cssPaths, ...initial.storyFiles],
    {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 },
    },
  );
  let watchedStoryFiles = new Set(initial.storyFiles);

  let regenerating = false;
  const onChange = async (event: 'change' | 'add' | 'unlink', file: string) => {
    const abs = path.resolve(file);
    const isMd = file.endsWith('.md');
    const isCss = ctx.cssPaths.includes(abs);
    const isStory = watchedStoryFiles.has(abs);
    const isHtmlLayout =
      file.endsWith('.html') && ctx.layoutDirs.some((d) => abs.startsWith(d + path.sep));
    // Story files inside docsDir are picked up by the docsDir watcher; only
    // bypass this guard for files we care about.
    if (!isMd && !isCss && !isStory && !isHtmlLayout) return;
    if (regenerating) return;
    regenerating = true;
    try {
      const t0 = Date.now();
      if (isCss) ctx.userCss = await loadUserCss(ctx.cssPaths);
      if (isStory) {
        // The story file's export list and/or source may have changed —
        // invalidate both caches so the next parse re-reads them.
        invalidateExportsCache(abs);
        invalidateCodeCache(abs);
      }
      const result = await writePages(ctx, { clean: false, searchEnabled: false });

      // Add newly-referenced story files to the watcher (e.g. a markdown
      // page now points at a new `:::stories` source). Removing stale
      // watches is rare and not worth the bookkeeping; chokidar tolerates
      // missing files silently.
      const fresh = result.storyFiles.filter((p) => !watchedStoryFiles.has(p));
      if (fresh.length > 0) {
        watcher.add(fresh);
        for (const p of fresh) watchedStoryFiles.add(p);
      }
      watchedStoryFiles = new Set(result.storyFiles);

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
  siteTitle: string | null,
  siteDescription: string | undefined,
): Promise<void> {
  await emitPerPageLlmsTxt(pages, outDir);

  // Fall back to the index page's title (or the first page's) so the
  // llms.txt index still has a meaningful H1 when no `config.title` was
  // supplied.
  const indexPage = pages.find((p) => isIndexHref(p.htmlRelPath));
  const titleH1 = siteTitle ?? indexPage?.parsed.title ?? pages[0]?.parsed.title ?? 'Documentation';

  const lines: string[] = [];
  lines.push(`# ${titleH1}`);
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

/**
 * Write every page's plain-markdown mirror to `<base>/llms/<page>.txt`.
 * Used both by `emitLlms` (for the static dist output) and `writePages`
 * (for the dev/build tmpDir so the "View as Markdown" buttons resolve).
 */
async function emitPerPageLlmsTxt(pages: PageRecord[], baseDir: string): Promise<void> {
  const llmsDir = path.join(baseDir, 'llms');
  for (const page of pages) {
    const txtAbs = path.join(llmsDir, page.txtRelPath);
    await fs.mkdir(path.dirname(txtAbs), { recursive: true });
    const startsWithH1 = /^#\s/.test(page.parsed.plainMarkdown);
    const txtContent = startsWithH1
      ? page.parsed.plainMarkdown
      : `# ${page.parsed.title}\n\n${page.parsed.plainMarkdown}`;
    await fs.writeFile(txtAbs, `${txtContent}\n`);
  }
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

/**
 * Render the "Open in playground" button(s) emitted next to each story-block
 * when `MarkbookConfig.playground` is set. Each button carries the form
 * descriptor as a single base64-encoded JSON blob in `data-payload`; the
 * boot script (`PLAYGROUND_BOOT_SCRIPT`) decodes on click, builds a hidden
 * form, and submits to the provider.
 *
 * When `playground.inlineSourceImports` is configured, the story's relative
 * imports are walked (transitively) and any matching source files are
 * included in the sandbox at their original repo-relative path so existing
 * `'../../../src/foo.js'`-style imports resolve without rewriting.
 */
async function renderPlaygroundButtons(
  story: StoryRef,
  config: PlaygroundConfig,
  pageFile: string,
  ctxRoot: string,
): Promise<string> {
  const files = story.codeFiles ?? [];
  if (files.length === 0) return '';

  // The story file's path relative to the config root — used as the
  // sandbox-side path so the entry can import it correctly.
  const storyAbsPath = resolveSpec(story.src, path.dirname(pageFile));
  if (!storyAbsPath) return '';
  const storyRelPath = path.relative(ctxRoot, storyAbsPath).replace(/\\/g, '/');
  const storyDir = path.dirname(storyRelPath);
  const storyFileName = path.basename(storyAbsPath);

  // Resolve sibling CSS imports (and the story itself) to root-relative
  // paths so they line up with any inlined sources under the same `src/`
  // tree in the sandbox.
  const playgroundFiles = files.map((f, i) => {
    const candidate = path.posix.join(storyDir, f.label);
    return {
      path: i === 0 ? storyRelPath : candidate,
      content: f.code,
    };
  });

  let inlinedSources: { path: string; content: string }[] | undefined;
  if (config.inlineSourceImports && config.inlineSourceImports.length > 0) {
    const inlined = await resolveInlinedSources({
      storyAbsPath,
      root: ctxRoot,
      inlinePatterns: config.inlineSourceImports,
    });
    inlinedSources = inlined.map((f) => ({
      path: f.relPath.replace(/\\/g, '/'),
      content: f.content,
    }));
  }

  const descriptors = buildPlaygroundDescriptors({
    storyFiles: playgroundFiles,
    inlinedSources,
    config,
    storyEntryFile: storyRelPath,
    title: `${path.basename(pageFile, '.md')} — ${story.exportName} — ${storyFileName}`,
  });

  const buttons = descriptors
    .map((d) => {
      const payload = Buffer.from(JSON.stringify(d), 'utf8').toString('base64');
      return `<button type="button" class="markbook-playground-btn" data-markbook-playground data-payload="${payload}" title="${escapeAttr(d.label)}">${escapeText(d.label)}</button>`;
    })
    .join('');

  return `<div class="markbook-playground">${buttons}</div>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    let importSpec: string;
    if (isPathLikeSpec(s.src)) {
      const abs = path.resolve(pageDir, s.src);
      let rel = path.relative(entryDir, abs).replace(/\\/g, '/');
      if (!rel.startsWith('.')) rel = `./${rel}`;
      importSpec = rel;
    } else {
      // Bare specifier — import as-is, Vite resolves through node_modules.
      importSpec = s.src;
    }
    importLines.push(`import * as story_${i}_mod from ${JSON.stringify(importSpec)};`);
  });

  const setups = stories.map((s, i) => {
    const exportRef =
      s.exportName === 'default'
        ? `story_${i}_mod.default`
        : `story_${i}_mod[${JSON.stringify(s.exportName)}]`;
    const decoratorsField =
      decoratorRefs.length > 0 ? `decorators: [${decoratorRefs.join(', ')}], ` : '';
    return `
const _exp_${i} = ${exportRef};
const _csf_${i} = __mb_isCsf(_exp_${i});
const story_${i} = _csf_${i} ? _exp_${i}.render : _exp_${i};
const args_${i} = (() => {
  const a = _csf_${i} ? _exp_${i}.args : story_${i}_mod.args;
  return a ? { ...a } : undefined;
})();
const argTypes_${i} = _csf_${i} ? _exp_${i}.argTypes : story_${i}_mod.argTypes;
const params_${i} = _csf_${i} ? _exp_${i}.parameters : story_${i}_mod.parameters;
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

  return `${importLines.join('\n')}\n${MB_CSF_HELPER}\n${setups.join('\n')}\n`;
}

/**
 * Runtime helper that distinguishes a Storybook CSF v3 story object from
 * a plain component object (e.g. Vue's `defineComponent({ render })` or
 * React's `forwardRef`). To be considered a CSF story, the value must:
 *   - be a non-null object
 *   - have a `render` function
 *   - carry at least one of the CSF metadata fields (args, argTypes,
 *     parameters, or name) so we don't unwrap arbitrary component objects
 *     that happen to expose a `render` method.
 */
const MB_CSF_HELPER = `function __mb_isCsf(v) {
  if (!v || typeof v !== 'object') return false;
  if (typeof v.render !== 'function') return false;
  return !!(v.args || v.argTypes || v.parameters || typeof v.name === 'string');
}`;

/**
 * Bundle the data that's reused across the built-in shell and HTML
 * layouts when rendering a single page. Computed once per page in
 * `writePages`, then passed into `renderBuiltinShell` / `renderLayout`.
 */
interface PageRenderContext {
  page: PageRecord;
  nav: NavGroup[];
  siteTitle: string | null;
  entryBasename: string | null;
  searchEnabled: boolean;
  userCss: string;
  disableBaseCss: boolean;
  llmsButtons: boolean;
  /** Function that rewrites a `target` path (e.g. `index.html`) to a relative href from this page. */
  resolveHref: (target: string) => string;
  /** Relative path from this page to `pagefind/` (no trailing slash). */
  pagefindBase: string;
  /** Effective browser-tab title for this page. */
  browserTitle: string;
  /** What goes in the header brand on the built-in shell. */
  brandText: string;
}

function buildPageRenderContext(
  page: PageRecord,
  nav: NavGroup[],
  siteTitle: string | null,
  entryBasename: string | null,
  searchEnabled: boolean,
  userCss: string,
  disableBaseCss: boolean,
  llmsButtons: boolean,
): PageRenderContext {
  const fromDir = path.dirname(page.htmlRelPath);

  const resolveHref = (target: string): string => {
    let rel = path.relative(fromDir, target).replace(/\\/g, '/');
    if (rel === '') rel = path.basename(target);
    if (!rel.startsWith('.') && !rel.startsWith('/')) rel = `./${rel}`;
    return rel;
  };

  const pagefindBase = (() => {
    let rel = path.relative(fromDir, 'pagefind').replace(/\\/g, '/');
    if (rel === '') rel = 'pagefind';
    if (!rel.startsWith('.') && !rel.startsWith('/')) rel = `./${rel}`;
    return rel;
  })();

  const pageTitle = page.parsed.title;
  const browserTitle = siteTitle ? `${pageTitle} — ${siteTitle}` : pageTitle;
  const brandText = siteTitle ?? pageTitle;

  return {
    page,
    nav,
    siteTitle,
    entryBasename,
    searchEnabled,
    userCss,
    disableBaseCss,
    llmsButtons,
    resolveHref,
    pagefindBase,
    browserTitle,
    brandText,
  };
}

/**
 * Build the Markbook-required content that lives inside `<head>` and is
 * inserted via the `{{ head }}` placeholder in HTML layouts.
 *
 * Deliberately does NOT include `<title>`, `<meta charset>`, or `<meta
 * viewport>` — those are the layout author's call. Use
 * `{{ browserTitle }}` for the title string.
 */
function buildHeadInjections(prc: PageRenderContext): string {
  const pagefindLink = prc.searchEnabled
    ? `<link href="${prc.pagefindBase}/pagefind-ui.css" rel="stylesheet">`
    : '';
  const parts = [
    `<script>${THEME_BOOT_SCRIPT}</script>`,
    `<script>${TABS_BOOT_SCRIPT}</script>`,
    `<script>${PLAYGROUND_BOOT_SCRIPT}</script>`,
    `<script>${COPY_BOOT_SCRIPT}</script>`,
    `<script>${PERMALINK_BOOT_SCRIPT}</script>`,
  ];
  if (prc.llmsButtons) parts.push(`<script>${COPY_MD_BOOT_SCRIPT}</script>`);
  if (prc.searchEnabled) parts.push(`<script>${SEARCH_KBD_BOOT_SCRIPT}</script>`);
  if (pagefindLink) parts.push(pagefindLink);
  if (!prc.disableBaseCss) parts.push(`<style>${BASE_CSS}</style>`);
  if (prc.userCss) parts.push(`<style data-markbook-user-css>${prc.userCss}</style>`);
  return parts.join('\n');
}

/**
 * Build the Markbook-required content that goes at end-of-body — the
 * Pagefind UI script + init, plus the story entry module script. Inserted
 * via the `{{ bodyEnd }}` placeholder in HTML layouts.
 */
function buildBodyEndInjections(prc: PageRenderContext): string {
  const pagefindScripts = prc.searchEnabled
    ? `<script src="${prc.pagefindBase}/pagefind-ui.js"></script>
<script>
  window.addEventListener('DOMContentLoaded', () => {
    if (typeof PagefindUI !== 'undefined') {
      new PagefindUI({ element: '#markbook-search-ui', showSubResults: true });
    }
  });
</script>`
    : '';
  const entryScript = prc.entryBasename
    ? `<script type="module" src="./${prc.entryBasename}"></script>`
    : '';
  return [pagefindScripts, entryScript].filter(Boolean).join('\n');
}

/** The Pagefind search input slot. Empty when search is disabled. */
function buildSearchSlot(prc: PageRenderContext): string {
  return prc.searchEnabled ? '<div id="markbook-search-ui" class="markbook-search-ui"></div>' : '';
}

/** The dark/light toggle button. */
function buildThemeToggle(): string {
  return `<button class="markbook-theme-toggle" type="button" data-markbook-theme-toggle aria-label="Toggle theme"><span class="markbook-icon-sun" aria-hidden>☀</span><span class="markbook-icon-moon" aria-hidden>☾</span></button>`;
}

/**
 * Render a page using the built-in Markbook shell (header + sidebar + TOC).
 * Used when no HTML layout is configured for the page.
 */
function renderBuiltinShell(prc: PageRenderContext): string {
  const homeItem = prc.nav.find((g) => g.label === null)?.items[0];
  const homeHref = homeItem ? prc.resolveHref(homeItem.htmlRelPath) : prc.resolveHref('index.html');

  const navHtml = prc.nav
    .map((group) => {
      const itemsHtml = group.items
        .map((n) => {
          const href = prc.resolveHref(n.htmlRelPath);
          const active = n.id === prc.page.fileId;
          return `<li><a href="${href}"${active ? ' class="active" aria-current="page"' : ''}>${escapeHtml(n.title)}</a></li>`;
        })
        .join('');
      const heading = group.label ? `<h2>${escapeHtml(group.label)}</h2>` : '';
      return `<div class="markbook-nav-group">${heading}<ul>${itemsHtml}</ul></div>`;
    })
    .join('');

  const tocItems = prc.page.parsed.headings.filter((h) => h.level === 2 || h.level === 3);
  const tocHtml = tocItems
    .map((h) => `<li class="toc-h${h.level}"><a href="#${h.slug}">${escapeHtml(h.text)}</a></li>`)
    .join('');
  const tocBlock =
    tocItems.length > 0
      ? `<aside class="markbook-toc"><h3>On this page</h3><ul>${tocHtml}</ul></aside>`
      : '';
  const shellClass = tocItems.length > 0 ? 'markbook-shell' : 'markbook-shell no-toc';

  const headInjections = buildHeadInjections(prc);
  const bodyEndInjections = buildBodyEndInjections(prc);
  const searchSlot = buildSearchSlot(prc);
  const themeToggle = buildThemeToggle();
  const pageActions = prc.llmsButtons ? renderPageActions(prc.page, prc.resolveHref) : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(prc.browserTitle)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
${headInjections}
</head>
<body>
<header class="markbook-header">
  <a class="markbook-brand" href="${homeHref}"><span class="markbook-logo" aria-hidden>📘</span> ${escapeHtml(prc.brandText)}</a>
  ${searchSlot}
  ${themeToggle}
</header>
<div class="${shellClass}">
  <aside class="markbook-sidebar">
    <nav class="markbook-nav" aria-label="Site">${navHtml}</nav>
  </aside>
  <main class="markbook-main">
    <article class="markbook-content" data-pagefind-body>
${pageActions}${prc.page.parsed.html}
    </article>
  </main>
  ${tocBlock}
</div>
${bodyEndInjections}
</body>
</html>
`;
}

/**
 * Render a page using a user-supplied HTML layout. Builds the
 * substitution map and delegates to `applyHtmlLayout`, which validates
 * that the layout has exactly one `{{ content }}` and rejects unknown
 * placeholders.
 *
 * The layout owns the entire `<html>`/`<head>`/`<body>` structure. The
 * `{{ content }}` placeholder receives the page's INNER HTML — the
 * layout supplies its own `<article ... data-pagefind-body>` wrapper if
 * it wants Pagefind to index the page.
 */
function renderLayout(prc: PageRenderContext, layoutName: string, layoutBody: string): string {
  const subs: HtmlLayoutSubstitutions = {
    raw: {
      content: prc.page.parsed.html,
      head: buildHeadInjections(prc),
      bodyEnd: buildBodyEndInjections(prc),
      pageActions: prc.llmsButtons ? renderPageActions(prc.page, prc.resolveHref) : '',
      search: buildSearchSlot(prc),
      themeToggle: buildThemeToggle(),
    },
    text: {
      title: prc.page.parsed.title,
      description: stringifyOrEmpty(prc.page.parsed.frontmatter.description),
      siteTitle: prc.siteTitle ?? '',
      browserTitle: prc.browserTitle,
    },
  };
  return applyHtmlLayout(layoutBody, subs, prc.page.parsed.frontmatter, layoutName);
}

function stringifyOrEmpty(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/**
 * Resolve the layout name to use for a given page. Returns `null` when
 * the built-in shell should be used.
 *
 * Resolution order:
 *   1. Per-page frontmatter `layout: <name>` wins (or `layout: false` to
 *      force the built-in shell even when a default is configured).
 *   2. `MarkbookConfig.layout` provides the site-wide default.
 *   3. Otherwise, no layout — built-in shell.
 */
export function resolvePageLayout(page: PageRecord, defaultLayout: string | null): string | null {
  const fm = page.parsed.frontmatter.layout;
  if (fm === false) return null;
  if (typeof fm === 'string') return fm;
  if (fm != null) {
    throw new Error(
      `Markbook: ${page.relPath} has invalid \`layout:\` frontmatter — expected a string layout name or \`false\`, got ${JSON.stringify(fm)}.`,
    );
  }
  return defaultLayout;
}

/**
 * Render the "View as Markdown" / "Copy as Markdown" action buttons that
 * point at the page's per-page llms.txt mirror. Wrapped in
 * `data-pagefind-ignore` so Pagefind doesn't index the button labels.
 */
function renderPageActions(page: PageRecord, resolveHref: (target: string) => string): string {
  const llmsHref = resolveHref(`llms/${page.txtRelPath}`);
  return `<div class="markbook-page-actions" role="group" aria-label="Page actions" data-pagefind-ignore><a class="markbook-page-action" href="${llmsHref}" target="_blank" rel="noopener" title="View this page as plain markdown (opens in a new tab)">View as Markdown</a><button type="button" class="markbook-page-action" data-markbook-copy-md data-url="${llmsHref}" title="Copy this page's markdown to clipboard"><span class="markbook-copy-md-label">Copy as Markdown</span></button></div>`;
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

const TABS_BOOT_SCRIPT = `(function(){function activate(tab){var wrap=tab.closest('[data-markbook-tabs]');if(!wrap)return;var tabs=wrap.querySelectorAll('[role="tab"]');var pid=tab.getAttribute('aria-controls');for(var i=0;i<tabs.length;i++){var t=tabs[i];t.setAttribute('aria-selected',t===tab?'true':'false');t.tabIndex=t===tab?0:-1;}var panels=wrap.querySelectorAll('[role="tabpanel"]');for(var j=0;j<panels.length;j++){panels[j].hidden=panels[j].id!==pid;}}document.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('[role="tab"]');if(t&&t.closest('[data-markbook-tabs]'))activate(t);});document.addEventListener('keydown',function(e){var t=e.target&&e.target.closest&&e.target.closest('[role="tab"]');if(!t||!t.closest('[data-markbook-tabs]'))return;if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();var tabs=t.parentElement.querySelectorAll('[role="tab"]');var i=Array.prototype.indexOf.call(tabs,t);var n=e.key==='ArrowRight'?(i+1)%tabs.length:(i-1+tabs.length)%tabs.length;tabs[n].focus();activate(tabs[n]);});})();`;

/**
 * Delegated click handler for [data-markbook-playground] buttons. Each button
 * carries a base64-encoded JSON descriptor with provider-specific form
 * fields (action URL + named values). On click we decode, build a hidden
 * form, append to body, submit, then remove. Posts in a new tab so the
 * docs page is not navigated away from.
 */
const PLAYGROUND_BOOT_SCRIPT = `(function(){document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-markbook-playground]');if(!b)return;e.preventDefault();var d;try{d=JSON.parse(atob(b.getAttribute('data-payload')||''));}catch(err){console.error('markbook: malformed playground payload',err);return;}var f=document.createElement('form');f.action=d.action;f.method='POST';f.target='_blank';f.style.display='none';for(var i=0;i<d.fields.length;i++){var pair=d.fields[i];var input=document.createElement('input');input.type='hidden';input.name=pair[0];input.value=pair[1];f.appendChild(input);}document.body.appendChild(f);f.submit();f.parentNode.removeChild(f);});})();`;

/**
 * Copy-code button. Delegated click handler reads the nearest `<pre>` block,
 * extracts its textContent, copies via navigator.clipboard, briefly flips
 * the button label to "Copied!" for ~1.2s.
 */
const COPY_BOOT_SCRIPT = `(function(){document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-markbook-copy]');if(!b)return;e.preventDefault();var wrap=b.closest('.markbook-code-pre-wrap');var pre=wrap&&wrap.querySelector('pre');if(!pre||!navigator.clipboard)return;navigator.clipboard.writeText(pre.textContent||'').then(function(){var lbl=b.querySelector('.markbook-copy-label');if(!lbl)return;var prev=lbl.textContent;lbl.textContent='Copied!';b.classList.add('is-copied');setTimeout(function(){lbl.textContent=prev;b.classList.remove('is-copied');},1200);}).catch(function(err){console.error('markbook: clipboard write failed',err);});});})();`;

/**
 * Heading permalinks. Click on a [data-markbook-permalink] anchor copies the
 * canonical page URL + fragment to the clipboard (still navigates, so the
 * URL bar updates as expected). Modifier-clicks (cmd/ctrl/shift) skip the
 * clipboard write so users can open in a new tab via standard browser UX.
 */
const PERMALINK_BOOT_SCRIPT = `(function(){document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('[data-markbook-permalink]');if(!a)return;if(e.metaKey||e.ctrlKey||e.shiftKey)return;if(!navigator.clipboard)return;var h=a.getAttribute('href')||'';var url=location.origin+location.pathname+h;navigator.clipboard.writeText(url).catch(function(){});});})();`;

/**
 * Cmd-K / Ctrl-K opens the Pagefind search input. Slash key also works
 * (Algolia DocSearch / GitHub convention). Only active when search is
 * enabled — handler is omitted from the HTML in dev mode.
 */
const SEARCH_KBD_BOOT_SCRIPT = `(function(){function focus(){var input=document.querySelector('.pagefind-ui input, #markbook-search-ui input');if(input){input.focus();input.select&&input.select();return true;}return false;}document.addEventListener('keydown',function(e){var t=e.target;var inField=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable);if((e.key==='k'||e.key==='K')&&(e.metaKey||e.ctrlKey)){e.preventDefault();focus();return;}if(e.key==='/'&&!inField){e.preventDefault();focus();}});})();`;

/**
 * "Copy as Markdown" button handler. Delegated click reads the button's
 * data-url, fetches the per-page llms.txt mirror, writes the content to
 * the clipboard, and flips the label to "Copied!" for ~1.2s. Detects
 * file:// (where fetch can't reach the .txt file) and shows a tooltip
 * instead of silently failing.
 */
const COPY_MD_BOOT_SCRIPT = `(function(){if(location.protocol==='file:'){var btns=document.querySelectorAll('[data-markbook-copy-md]');for(var i=0;i<btns.length;i++){var b=btns[i];b.disabled=true;b.title='Serve this site over http(s) to copy markdown.';b.style.opacity='0.5';b.style.cursor='not-allowed';}return;}document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-markbook-copy-md]');if(!b)return;e.preventDefault();if(!navigator.clipboard){return;}var url=b.getAttribute('data-url')||'';var lbl=b.querySelector('.markbook-copy-md-label');var prev=lbl?lbl.textContent:'';fetch(url).then(function(r){if(!r.ok)throw new Error('http '+r.status);return r.text();}).then(function(text){return navigator.clipboard.writeText(text);}).then(function(){if(!lbl)return;lbl.textContent='Copied!';b.classList.add('is-copied');setTimeout(function(){lbl.textContent=prev;b.classList.remove('is-copied');},1200);}).catch(function(err){console.error('markbook: copy-as-markdown failed',err);if(!lbl)return;lbl.textContent='Copy failed';setTimeout(function(){lbl.textContent=prev;},1500);});});})();`;

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
.markbook-playground {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  border-left: 1px solid var(--mb-border);
  border-right: 1px solid var(--mb-border);
  background: var(--mb-bg);
  padding: 0.5rem 1rem;
}
.markbook-playground-btn {
  appearance: none;
  border: 1px solid var(--mb-border);
  background: var(--mb-bg-soft);
  color: var(--mb-fg-muted);
  font-family: var(--mb-font-sans);
  font-size: 0.78rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  transition: border-color .12s ease, color .12s ease, background .12s ease;
}
.markbook-playground-btn:hover {
  border-color: var(--mb-accent);
  color: var(--mb-fg);
  background: var(--mb-bg-elev);
}
.markbook-playground-btn:focus-visible {
  outline: 2px solid var(--mb-accent);
  outline-offset: 2px;
}
.markbook-page-actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin: -0.5rem 0 1.5rem;
}
.markbook-page-action {
  appearance: none;
  border: 1px solid var(--mb-border);
  background: var(--mb-bg-soft);
  color: var(--mb-fg-muted);
  font-family: var(--mb-font-sans);
  font-size: 0.78rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  text-decoration: none;
  transition: border-color .12s ease, color .12s ease, background .12s ease;
}
.markbook-page-action:hover {
  border-color: var(--mb-accent);
  color: var(--mb-fg);
  background: var(--mb-bg-elev);
}
.markbook-page-action:focus-visible {
  outline: 2px solid var(--mb-accent);
  outline-offset: 2px;
}
.markbook-page-action.is-copied {
  border-color: var(--mb-accent);
  color: var(--mb-accent);
}
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
.markbook-code-file + .markbook-code-file { border-top: 1px solid var(--mb-border); }
.markbook-code-file-label {
  padding: 0.4rem 1rem;
  font-size: 0.75rem;
  font-family: var(--mb-font-mono);
  color: var(--mb-fg-muted);
  background: var(--mb-bg-soft);
  border-bottom: 1px solid var(--mb-border);
}
.markbook-code-pre-wrap { position: relative; }
.markbook-code-copy {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  appearance: none;
  border: 1px solid var(--mb-border);
  background: var(--mb-bg);
  color: var(--mb-fg-muted);
  font-family: var(--mb-font-sans);
  font-size: 0.72rem;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity .12s ease, color .12s ease, border-color .12s ease;
}
.markbook-code-pre-wrap:hover .markbook-code-copy,
.markbook-code-copy:focus-visible { opacity: 1; }
.markbook-code-copy:hover { color: var(--mb-fg); border-color: var(--mb-accent); }
.markbook-code-copy.is-copied { opacity: 1; color: var(--mb-accent); border-color: var(--mb-accent); }
.markbook-code-copy:focus-visible { outline: 2px solid var(--mb-accent); outline-offset: 2px; }
.markbook-heading-anchor {
  display: inline-block;
  margin-left: 0.35rem;
  color: var(--mb-fg-muted);
  font-weight: 400;
  text-decoration: none;
  opacity: 0;
  transition: opacity .12s ease, color .12s ease;
}
.markbook-content h2:hover .markbook-heading-anchor,
.markbook-content h3:hover .markbook-heading-anchor,
.markbook-heading-anchor:focus-visible { opacity: 1; }
.markbook-heading-anchor:hover { color: var(--mb-accent); }
.markbook-heading-anchor:focus-visible { outline: 2px solid var(--mb-accent); outline-offset: 2px; border-radius: 3px; }
.markbook-code-tablist {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  background: var(--mb-bg-soft);
  border-bottom: 1px solid var(--mb-border);
  padding: 0 0.5rem;
}
.markbook-code-tablist [role="tab"] {
  appearance: none;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.5rem 0.75rem;
  font-family: var(--mb-font-mono);
  font-size: 0.75rem;
  color: var(--mb-fg-muted);
  cursor: pointer;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}
.markbook-code-tablist [role="tab"]:hover { color: var(--mb-fg); }
.markbook-code-tablist [role="tab"][aria-selected="true"] {
  color: var(--mb-fg);
  border-bottom-color: var(--mb-accent);
}
.markbook-code-tablist [role="tab"]:focus-visible {
  outline: 2px solid var(--mb-accent);
  outline-offset: -2px;
}
.markbook-code-tabs [role="tabpanel"] { display: block; }
.markbook-code-tabs [role="tabpanel"][hidden] { display: none; }
.markbook-code-tabs pre { padding: 1rem; margin: 0; overflow-x: auto; }
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
