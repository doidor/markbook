import path from 'node:path';
import fs from 'node:fs/promises';
import { glob } from 'tinyglobby';
import { build as viteBuild } from 'vite';
import * as pagefind from 'pagefind';
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

interface NavItem {
  id: string;
  title: string;
  htmlRelPath: string;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export async function build(config: MarkbookConfig): Promise<void> {
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
  const wrapperPath = config.adapter.wrapperModule
    ? path.resolve(root, config.adapter.wrapperModule)
    : undefined;

  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });

  const mdFiles = await glob('**/*.md', { cwd: docsDir, absolute: true });
  if (mdFiles.length === 0) {
    throw new Error(`No markdown files found in ${docsDir}`);
  }

  const pages: PageRecord[] = [];
  for (const file of mdFiles.sort()) {
    const relPath = path.relative(docsDir, file);
    const noExt = relPath.replace(/\.md$/, '');
    const htmlRelPath = `${noExt}.html`;
    const entryRelPath = `${noExt}.entry.ts`;
    const txtRelPath = `${noExt}.txt`;
    const fileId = noExt
      .replace(/[\\/]/g, '__')
      .replace(/[^a-z0-9_]/gi, '_');
    const segments = relPath.split(/[\\/]/);
    const groupKey =
      segments.length > 1 && segments[0] ? capitalize(segments[0]) : null;
    const source = await fs.readFile(file, 'utf8');
    const parsed = await parseMarkdown(source, fileId, {
      pageFile: file,
      resolveStoryCode: (info) =>
        extractStoryCode(info.absStoryFile, info.exportName),
      resolveProps: (info) =>
        extractComponentProps(info.absComponentFile, info.exportName, root),
      loadTemplate: async (name) => {
        for (const dir of templateDirs) {
          const candidate = path.join(dir, `${name}.md`);
          try {
            return await fs.readFile(candidate, 'utf8');
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
          }
        }
        const searched = templateDirs
          .map((d) => path.relative(root, d) || d)
          .join(', ');
        throw new Error(
          `Markbook: template '${name}' not found in: ${searched}`,
        );
      },
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
    const htmlAbs = path.join(tmpDir, page.htmlRelPath);
    const entryAbs = path.join(tmpDir, page.entryRelPath);
    await fs.mkdir(path.dirname(htmlAbs), { recursive: true });

    const entryCode = generateEntry(
      page.parsed.stories,
      path.dirname(page.file),
      config.adapter.packageName,
      path.dirname(entryAbs),
      wrapperPath,
    );
    const html = generateHtml(page, nav, siteTitle, path.basename(entryAbs));

    await fs.writeFile(entryAbs, entryCode);
    await fs.writeFile(htmlAbs, html);
    htmlInputs[page.fileId] = htmlAbs;
  }

  const adapterPlugins = config.adapter.vitePlugins
    ? await config.adapter.vitePlugins()
    : [];

  await viteBuild({
    root: tmpDir,
    base: './',
    plugins: adapterPlugins as never,
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: { input: htmlInputs },
    },
    logLevel: 'warn',
    configFile: false,
  });

  await emitLlms(pages, outDir, siteTitle, siteDescription);
  await runPagefind(outDir);
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
    groups.push({ label: null, items: groupMap.get(null)! });
  }
  const named = [...groupMap.entries()]
    .filter(([k]) => k !== null)
    .sort(([a], [b]) => (a as string).localeCompare(b as string));
  for (const [k, v] of named) groups.push({ label: k as string, items: v });
  return groups;
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

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function generateEntry(
  stories: StoryRef[],
  pageDir: string,
  adapterPkg: string,
  entryDir: string,
  wrapperPath: string | undefined,
): string {
  if (stories.length === 0) return 'export {};\n';

  const importLines: string[] = [];

  if (wrapperPath) {
    let rel = path.relative(entryDir, wrapperPath).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    importLines.push(`import Wrapper from ${JSON.stringify(rel)};`);
  }

  stories.forEach((s, i) => {
    const abs = path.resolve(pageDir, s.src);
    let rel = path.relative(entryDir, abs).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    importLines.push(
      `import { ${s.exportName} as story_${i} } from ${JSON.stringify(rel)};`,
    );
  });

  const wrapperArg = wrapperPath ? ', { wrapper: Wrapper }' : '';
  const mounts = stories.map(
    (s, i) =>
      `mount(document.querySelector('[data-markbook-story="${s.id}"]'), story_${i}${wrapperArg});`,
  );

  return `import { mount } from ${JSON.stringify(adapterPkg)};
${importLines.join('\n')}

${mounts.join('\n')}
`;
}

function generateHtml(
  page: PageRecord,
  nav: NavGroup[],
  siteTitle: string,
  entryBasename: string,
): string {
  const fromDir = path.dirname(page.htmlRelPath);

  const resolveHref = (target: string): string => {
    let rel = path.relative(fromDir, target).replace(/\\/g, '/');
    if (rel === '') rel = path.basename(target);
    if (!rel.startsWith('.') && !rel.startsWith('/')) rel = `./${rel}`;
    return rel;
  };

  const homeItem = nav.find((g) => g.label === null)?.items[0];
  const homeHref = homeItem
    ? resolveHref(homeItem.htmlRelPath)
    : resolveHref('index.html');

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
      const heading = group.label
        ? `<h2>${escapeHtml(group.label)}</h2>`
        : '';
      return `<div class="markbook-nav-group">${heading}<ul>${itemsHtml}</ul></div>`;
    })
    .join('');

  const tocItems = page.parsed.headings.filter(
    (h) => h.level === 2 || h.level === 3,
  );
  const tocHtml = tocItems
    .map(
      (h) =>
        `<li class="toc-h${h.level}"><a href="#${h.slug}">${escapeHtml(h.text)}</a></li>`,
    )
    .join('');
  const tocBlock =
    tocItems.length > 0
      ? `<aside class="markbook-toc"><h3>On this page</h3><ul>${tocHtml}</ul></aside>`
      : '';
  const shellClass =
    tocItems.length > 0 ? 'markbook-shell' : 'markbook-shell no-toc';

  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<title>${escapeHtml(page.parsed.title)} — ${escapeHtml(siteTitle)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="${pagefindBase}/pagefind-ui.css" rel="stylesheet">
<style>${BASE_CSS}</style>
</head>
<body>
<header class="markbook-header">
  <a class="markbook-brand" href="${homeHref}"><span class="markbook-logo" aria-hidden>📘</span> ${escapeHtml(siteTitle)}</a>
  <div id="markbook-search-ui" class="markbook-search-ui"></div>
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
<script src="${pagefindBase}/pagefind-ui.js"></script>
<script>
  window.addEventListener('DOMContentLoaded', () => {
    new PagefindUI({ element: '#markbook-search-ui', showSubResults: true, resetStyles: false });
  });
</script>
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
.markbook-search-ui {
  flex: 1;
  max-width: 360px;
  --pagefind-ui-scale: 0.875;
  --pagefind-ui-primary: var(--mb-accent);
  --pagefind-ui-text: var(--mb-fg);
  --pagefind-ui-background: var(--mb-bg-elev);
  --pagefind-ui-border: var(--mb-border);
  --pagefind-ui-border-radius: var(--mb-radius);
  --pagefind-ui-font: var(--mb-font-sans);
}
.markbook-search-ui .pagefind-ui__form { position: relative; }
.markbook-search-ui .pagefind-ui__search-input {
  height: 32px;
  font-size: 0.85rem;
  font-family: var(--mb-font-sans);
  background: var(--mb-bg-elev);
  color: var(--mb-fg);
  border: 1px solid var(--mb-border);
  border-radius: var(--mb-radius);
  width: 100%;
}
.markbook-search-ui .pagefind-ui__drawer {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  left: 0;
  max-height: 70vh;
  overflow-y: auto;
  background: var(--mb-bg);
  border: 1px solid var(--mb-border);
  border-radius: var(--mb-radius);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  padding: 0.75rem;
  z-index: 20;
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
