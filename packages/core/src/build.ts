import path from 'node:path';
import fs from 'node:fs/promises';
import { glob } from 'tinyglobby';
import { build as viteBuild, createLogger, createServer, preview as vitePreview } from 'vite';
import chokidar from 'chokidar';
import { parseMarkdown } from './parse.js';
import { extractStoryCode, invalidateCodeCache } from './code.js';
import { discoverStoryExports, invalidateExportsCache } from './exports.js';
import { extractComponentProps } from './props.js';
import { buildPlaygroundDescriptors } from './playground.js';
import { resolveInlinedSources } from './inline-sources.js';
import { isPathLikeSpec, resolveSpec } from './resolve.js';
import { BUILTIN_DIRECTIVES, staticAdapter } from './config.js';
import { escapeHtml, escapeAttribute } from './directive-utils.js';
import { MB_CSF_HELPER } from './entry-runtime.js';
import { ensureInlineAssetsMinified } from './assets.js';
import { minifyCss } from './minify.js';
import { runPagefind } from './pagefind.js';
import { buildNav, capitalize } from './nav.js';
import { emitLlms, emitPerPageLlmsTxt } from './llms.js';
import { emitSitemapAndRobots, normalizeSiteUrl } from './sitemap.js';
import {
  buildPageRenderContext,
  renderBuiltinShell,
  renderLayout,
  resolvePageLayout,
} from './render.js';
import type { ParsedPage, StoryRef } from './parse.js';
import type { MarkbookConfig, MarkbookAdapter, PlaygroundConfig } from './config.js';

// Façade re-exports: these symbols moved into focused sibling modules but
// stay reachable from `./build.js` so `internal.ts` and existing deep
// imports keep working.
export { runPagefind } from './pagefind.js';
export { sortNavItems, sortIndexFirst, isIndexHref, capitalize } from './nav.js';
export type { NavItem, NavGroup } from './nav.js';
export { resolvePageLayout } from './render.js';
export { emitLlms } from './llms.js';
export { emitSitemapAndRobots, normalizeSiteUrl } from './sitemap.js';

export interface PageRecord {
  file: string;
  relPath: string;
  htmlRelPath: string;
  entryRelPath: string;
  txtRelPath: string;
  fileId: string;
  groupKey: string | null;
  parsed: ParsedPage;
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
  /**
   * Absolute path to the static-asset directory, or `false` if the user
   * opted out. When set, Vite copies its contents to `outDir` at build
   * time and serves them at `/` during dev. See `MarkbookConfig.publicDir`.
   */
  publicDir: string | false;
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
  /**
   * Normalized canonical site origin (no trailing slash). When set, Markbook
   * emits `<link rel="canonical">`, `<meta property="og:url">`, and
   * generates `sitemap.xml` + `robots.txt` in the build output.
   */
  siteUrl: string | null;
  /** `<meta name="theme-color">` value (mobile browser chrome tint). */
  themeColor: string;
  /** Default OG / Twitter image URL when a page omits `ogImage` frontmatter. */
  ogImage: string | null;
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
  /**
   * Resolved user-directive registry, validated for built-in conflicts.
   * Keyed by directive name. Empty record means no user directives.
   */
  userDirectives: Record<string, import('./config.js').DirectiveHandler>;
}

/**
 * Read `<dir>/<name><ext>` from the first directory in `dirs` that has it.
 * Returns `null` when none match (so callers can throw a loader-specific
 * error). Re-throws any non-ENOENT fs error.
 */
async function loadFirstMatch(dirs: string[], name: string, ext: string): Promise<string | null> {
  for (const dir of dirs) {
    const candidate = path.join(dir, `${name}${ext}`);
    try {
      return await fs.readFile(candidate, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
  return null;
}

export function makeLoadTemplate(
  templateDirs: string[],
  root: string,
): (name: string) => Promise<string> {
  return async (name: string) => {
    const body = await loadFirstMatch(templateDirs, name, '.md');
    if (body !== null) return body;
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
    const body = await loadFirstMatch(layoutDirs, name, '.html');
    if (body !== null) return body;
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

/** Normalize an optional scalar-or-array config value into an array. */
function toList<T>(raw: T | T[] | undefined): T[] {
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * Resolve a path-like or bare specifier to an absolute path, throwing a
 * consistent, actionable error (keyed by `kind`) when it can't be resolved.
 */
function resolveSpecOrThrow(spec: string, root: string, kind: string): string {
  const resolved = resolveSpec(spec, root);
  if (!resolved) {
    throw new Error(
      `Markbook: ${kind} '${spec}' could not be resolved from ${root}. ` +
        `Use a relative path or install the bare-specifier package.`,
    );
  }
  return resolved;
}

export async function createContext(config: MarkbookConfig): Promise<BuildContext> {
  // One-time minification of the static inline boot scripts + BASE_CSS.
  // Pays a few-ms cost on first build; cached for the lifetime of the
  // process (no-op on subsequent calls, e.g. dev-mode regenerations).
  await ensureInlineAssetsMinified();
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
  // `publicDir: false` opts out entirely; otherwise resolve to an absolute
  // path so Vite (whose cwd is tmpDir) reads from the project root, not
  // from inside .markbook/.
  const publicDir =
    config.publicDir === false ? false : path.resolve(root, config.publicDir ?? 'public');
  const siteTitle = config.title ?? null;
  const siteDescription = config.description;
  const siteUrl = normalizeSiteUrl(config.siteUrl);
  const themeColor = config.themeColor ?? '#0a1228';
  const ogImage = config.ogImage ?? null;
  const templateDirs = toList(config.templatesDir ?? 'templates').map((d) => path.resolve(root, d));
  const layoutDirs = toList(config.layoutsDir ?? 'layouts').map((d) => path.resolve(root, d));
  const defaultLayout = config.layout ?? null;
  const adapter = config.adapter ?? staticAdapter();
  const decoratorPaths = (adapter.decoratorModules ?? []).map((m) =>
    resolveSpecOrThrow(m, root, 'decorator module'),
  );
  const adapterPlugins = adapter.vitePlugins ? await adapter.vitePlugins() : [];
  const cssPaths = toList(config.css).map((p) => resolveSpecOrThrow(p, root, 'css file'));
  const userCss = await loadUserCss(cssPaths);

  const userDirectives = (() => {
    const raw = config.directives ?? {};
    const builtin = new Set<string>(BUILTIN_DIRECTIVES);
    for (const name of Object.keys(raw)) {
      if (builtin.has(name)) {
        throw new Error(
          `Markbook: cannot register a user directive named '${name}' — it's a built-in ` +
            `(see BUILTIN_DIRECTIVES: ${BUILTIN_DIRECTIVES.join(', ')}). Choose a different name.`,
        );
      }
      if (!/^[a-z][a-z0-9-]*$/i.test(name)) {
        throw new Error(
          `Markbook: invalid directive name '${name}'. ` +
            `Names must be alphanumeric (with optional dashes) and start with a letter — remark-directive's parser will not match anything else.`,
        );
      }
    }
    return raw;
  })();

  return {
    config,
    root,
    docsDir,
    outDir,
    tmpDir,
    publicDir,
    templateDirs,
    layoutDirs,
    defaultLayout,
    decoratorPaths,
    siteTitle,
    siteDescription,
    siteUrl,
    themeColor,
    ogImage,
    adapter,
    adapterPackageName: adapter.packageName,
    adapterPlugins,
    hasControls: !!adapter.hasControls,
    cssPaths,
    userCss,
    disableBaseCss: !!config.disableBaseCss,
    playground: config.playground === false || !config.playground ? undefined : config.playground,
    llmsButtons: config.llmsButtons !== false,
    userDirectives,
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
  // Minify before returning — the result is inlined into every page's <head>
  // via `<style data-markbook-user-css>`, so trimming a 20KB stylesheet down
  // to ~12KB compounds across HTML output sizes (and silences Lighthouse's
  // "Minify CSS" warning).
  return minifyCss(sources.join('\n'));
}

interface WritePagesResult {
  pages: PageRecord[];
  htmlInputs: Record<string, string>;
  /** Absolute paths of every story file referenced by any directive. Used by `dev` for HMR watching. */
  storyFiles: string[];
  /**
   * Absolute paths user-directive handlers reported reading. Same shape as
   * `storyFiles` — both fold into `chokidar.watch` in dev so any change
   * triggers a re-render.
   */
  directiveDependencies: string[];
}

/**
 * Render every markdown page under `ctx.docsDir` into `ctx.tmpDir`.
 * Exported for integration tests that need to assert per-page HTML output
 * without invoking Vite. `build()` and `dev()` call this internally; most
 * consumers should use those instead.
 */
export async function writePages(
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
      userDirectives: ctx.userDirectives,
      root: ctx.root,
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
      ctx,
      hasStories ? path.basename(entryAbs) : null,
      opts.searchEnabled,
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
  const directiveDependencies = [...new Set(pages.flatMap((p) => p.parsed.directiveDependencies))];
  return { pages, htmlInputs, storyFiles, directiveDependencies };
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
    publicDir: ctx.publicDir,
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
    customLogger: buildQuietLogger(),
    configFile: false,
  });

  await emitLlms(pages, ctx.outDir, ctx.siteTitle, ctx.siteDescription);
  await emitSitemapAndRobots(pages, ctx.outDir, ctx.siteUrl);
  await runPagefind(ctx.outDir);
}

/**
 * A custom Vite logger that filters out the two cosmetic warnings Markbook
 * builds always produce:
 *
 *   1. `<script src="./pagefind/pagefind-ui.js"> in "X.html" can't be
 *      bundled without type="module" attribute` — Pagefind UI ships as a
 *      classic IIFE that registers `window.PagefindUI`, NOT an ES module.
 *      Vite warns because it can't fold it into the bundle, but passes
 *      the reference through unchanged, which is exactly what we want.
 *
 *   2. `./pagefind/pagefind-ui.css doesn't exist at build time, it will
 *      remain unchanged to be resolved at runtime` — the pagefind/
 *      directory is produced by `runPagefind()` AFTER viteBuild() returns,
 *      so the file is genuinely missing during Vite's transform pass.
 *      Vite passes the link through; the file is on disk by the time the
 *      browser loads the HTML.
 *
 * Both behaviours are intentional, and printing them on every build is
 * just noise. Real warnings (typos, missing modules, etc.) still surface.
 */
function buildQuietLogger() {
  const logger = createLogger('warn', { allowClearScreen: false });
  const isPagefindNoise = (msg: unknown): boolean => {
    if (typeof msg !== 'string') return false;
    if (msg.includes('/pagefind/pagefind-ui.js') && msg.includes("can't be bundled")) return true;
    if (msg.includes('/pagefind/pagefind-ui.css') && msg.includes("doesn't exist at build time")) {
      return true;
    }
    return false;
  };
  // Vite routes these warnings through different logger methods depending
  // on the rule that produced them; wrap them all to be safe.
  const originalWarn = logger.warn.bind(logger);
  const originalWarnOnce = logger.warnOnce.bind(logger);
  const originalInfo = logger.info.bind(logger);
  const originalError = logger.error.bind(logger);
  logger.warn = (msg, opts) => {
    if (isPagefindNoise(msg)) return;
    originalWarn(msg, opts);
  };
  logger.warnOnce = (msg, opts) => {
    if (isPagefindNoise(msg)) return;
    originalWarnOnce(msg, opts);
  };
  logger.info = (msg, opts) => {
    if (isPagefindNoise(msg)) return;
    originalInfo(msg, opts);
  };
  logger.error = (msg, opts) => {
    if (isPagefindNoise(msg)) return;
    originalError(msg, opts);
  };
  return logger;
}

/**
 * Serve a previously-built site (the `dist/` from `markbook build`) over
 * HTTP, the same way a production deploy would. Use this to verify the
 * built output locally — opening `dist/<page>.html` via `file://` breaks
 * dynamic-import-based features (notably Pagefind UI's search, which
 * needs a real HTTP origin) and isn't representative of how visitors
 * will see the site.
 *
 * Mirrors Vite's `preview` API but accepts the same `MarkbookConfig` the
 * other commands use — port comes from `config.dev.port` (or +1000 if
 * dev is configured, to avoid clashing when both run at once).
 */
export async function preview(config: MarkbookConfig): Promise<void> {
  const ctx = await createContext(config);
  // Reuse the same UTF-8 charset middleware we install in dev so the
  // preview server matches dev behaviour for .txt responses.
  const server = await vitePreview({
    root: ctx.tmpDir, // any valid root; Vite preview only reads outDir
    base: './',
    publicDir: ctx.publicDir,
    plugins: [utf8TxtPlugin()] as never,
    build: { outDir: ctx.outDir },
    preview: {
      port: config.dev?.port ? config.dev.port + 1000 : 4173,
      host: config.dev?.host,
    },
    logLevel: 'warn',
    configFile: false,
  });

  const localUrls = server.resolvedUrls?.local ?? [];
  const networkUrls = server.resolvedUrls?.network ?? [];
  console.log('');
  console.log('  Markbook preview server ready (serving dist/ over HTTP):');
  for (const url of localUrls) console.log(`    ➜  Local:   ${url}`);
  for (const url of networkUrls) console.log(`    ➜  Network: ${url}`);
  console.log('');
  console.log('  Use this to test the built site as visitors will see it.');
  console.log('  Opening dist/*.html via file:// breaks Pagefind search + other dynamic imports.');
  console.log('  Ctrl-C to stop.');
  console.log('');
}

export async function dev(config: MarkbookConfig): Promise<void> {
  const ctx = await createContext(config);
  // Search is now ON in dev too — the search slot, Pagefind CSS link, and
  // body-end init script all render. `runPagefind(ctx.tmpDir)` below
  // produces the index Vite serves under `/pagefind/`. Cost on a 5-page
  // site is sub-200ms per regeneration; well worth getting search in the
  // iteration loop.
  const initial = await writePages(ctx, { clean: true, searchEnabled: true });
  // Also emit `llms.txt` + per-page mirrors so the layout's "All pages as
  // markdown" link (and any per-page `View as Markdown` button) work in
  // dev — not just in `markbook build`.
  await emitLlms(initial.pages, ctx.tmpDir, ctx.siteTitle, ctx.siteDescription);
  await emitSitemapAndRobots(initial.pages, ctx.tmpDir, ctx.siteUrl);
  await runPagefind(ctx.tmpDir);

  const server = await createServer({
    root: ctx.tmpDir,
    base: '/',
    appType: 'mpa',
    publicDir: ctx.publicDir,
    plugins: [...(ctx.adapterPlugins as never[]), utf8TxtPlugin()],
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
    [
      ctx.docsDir,
      ...ctx.templateDirs,
      ...ctx.layoutDirs,
      ...ctx.cssPaths,
      ...initial.storyFiles,
      ...initial.directiveDependencies,
    ],
    {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 },
    },
  );
  let watchedStoryFiles = new Set(initial.storyFiles);
  let watchedDirectiveDeps = new Set(initial.directiveDependencies);

  let regenerating = false;
  const onChange = async (event: 'change' | 'add' | 'unlink', file: string) => {
    const abs = path.resolve(file);
    const isMd = file.endsWith('.md');
    const isCss = ctx.cssPaths.includes(abs);
    const isStory = watchedStoryFiles.has(abs);
    const isDirectiveDep = watchedDirectiveDeps.has(abs);
    const isHtmlLayout =
      file.endsWith('.html') && ctx.layoutDirs.some((d) => abs.startsWith(d + path.sep));
    // Story files inside docsDir are picked up by the docsDir watcher; only
    // bypass this guard for files we care about.
    if (!isMd && !isCss && !isStory && !isHtmlLayout && !isDirectiveDep) return;
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
      const result = await writePages(ctx, { clean: false, searchEnabled: true });
      await emitLlms(result.pages, ctx.tmpDir, ctx.siteTitle, ctx.siteDescription);
      await emitSitemapAndRobots(result.pages, ctx.tmpDir, ctx.siteUrl);
      await runPagefind(ctx.tmpDir);

      // Add newly-referenced story files + directive dependencies to the
      // watcher (e.g. a markdown page now points at a new `:::stories`
      // source, or a directive handler started reading a new file).
      // Removing stale watches is rare and not worth the bookkeeping;
      // chokidar tolerates missing files silently.
      const freshStories = result.storyFiles.filter((p) => !watchedStoryFiles.has(p));
      const freshDeps = result.directiveDependencies.filter((p) => !watchedDirectiveDeps.has(p));
      if (freshStories.length > 0 || freshDeps.length > 0) {
        watcher.add([...freshStories, ...freshDeps]);
        for (const p of freshStories) watchedStoryFiles.add(p);
        for (const p of freshDeps) watchedDirectiveDeps.add(p);
      }
      watchedStoryFiles = new Set(result.storyFiles);
      watchedDirectiveDeps = new Set(result.directiveDependencies);

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

/**
 * Tiny Vite plugin for `markbook dev` — stamps `Content-Type: text/plain;
 * charset=utf-8` on every `.txt` response. Without it, Vite (like Python's
 * `http.server`) sends bare `text/plain`, and browsers fall back to a
 * legacy single-byte encoding — turning every emoji and em-dash in
 * `/llms.txt` and `/llms/<page>.txt` into mojibake.
 *
 * The build-time output is also protected by a UTF-8 BOM (see UTF8_BOM
 * usage in `emitLlms` / `emitPerPageLlmsTxt`); this plugin is the
 * belt-and-braces dev-mode fix.
 */
function utf8TxtPlugin() {
  return {
    name: 'markbook:utf8-txt',
    configureServer(server: {
      middlewares: {
        use: (
          handler: (
            req: { url?: string },
            res: { setHeader: (k: string, v: string) => void },
            next: () => void,
          ) => void,
        ) => void;
      };
    }) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        // Strip query string before extension check (Vite often appends ?import).
        const pathOnly = url.split('?')[0] ?? '';
        if (pathOnly.endsWith('.txt')) {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        }
        next();
      });
    },
  };
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
      return `<button type="button" class="markbook-playground-btn" data-markbook-playground data-payload="${payload}" title="${escapeAttribute(d.label)}">${escapeHtml(d.label)}</button>`;
    })
    .join('');

  return `<div class="markbook-playground">${buttons}</div>`;
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
