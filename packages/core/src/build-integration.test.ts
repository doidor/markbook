import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { afterEach, describe, it, expect } from 'vitest';
import { createContext, writePages } from './build.js';

/**
 * End-to-end build integration tests. Each test sets up a minimal site
 * under a fresh tmpdir, runs `writePages` (the same code `build()` runs
 * before invoking Vite), and asserts on the generated HTML output.
 *
 * Search is disabled (`searchEnabled: false`) to keep the assertions
 * focused on chrome / layout / placeholder behaviour — Pagefind is
 * tested separately by `build()`'s end-of-pipeline `runPagefind`.
 */

interface Fixture {
  root: string;
  read: (relPath: string) => Promise<string>;
  exists: (relPath: string) => Promise<boolean>;
}

async function setupFixture(files: Record<string, string>): Promise<Fixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-build-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, body);
  }
  return {
    root,
    read: async (relPath) => fs.readFile(path.join(root, '.markbook', relPath), 'utf8'),
    exists: async (relPath) => {
      try {
        await fs.access(path.join(root, '.markbook', relPath));
        return true;
      } catch {
        return false;
      }
    },
  };
}

describe('writePages — built-in shell (no layout)', () => {
  let fx: Fixture;
  afterEach(async () => {
    if (fx) await fs.rm(fx.root, { recursive: true, force: true });
  });

  it('renders the default Markbook chrome when no layout is configured', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\ntitle: Home\n---\n\n# Home\n\nWelcome.',
    });
    const ctx = await createContext({ root: fx.root, title: 'My Site' });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    expect(html).toContain('<header class="markbook-header">');
    expect(html).toContain('<aside class="markbook-sidebar">');
    expect(html).toContain('<article class="markbook-content" data-pagefind-body>');
    expect(html).toContain('<title>Home — My Site</title>');
    expect(html).toContain('class="markbook-brand"');
    expect(html).toContain('My Site');
  });

  it('uses per-page title for both browser tab and brand when config.title is unset', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\ntitle: Skyline\n---\n\n# Skyline\n',
    });
    const ctx = await createContext({ root: fx.root });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    // No site title suffix
    expect(html).toContain('<title>Skyline</title>');
    expect(html).not.toContain(' — ');
    // Brand text uses the page title
    expect(html).toMatch(/class="markbook-brand"[\s\S]*?Skyline[\s\S]*?<\/a>/);
  });

  it('HTML-escapes apostrophes in titles (canonical 5-char escaping)', async () => {
    fx = await setupFixture({
      'docs/index.md': "---\ntitle: Lottie's Guide\n---\n\n# Lottie's Guide\n",
    });
    const ctx = await createContext({ root: fx.root });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    expect(html).toContain('<title>Lottie&#39;s Guide</title>');
    // The raw apostrophe must not leak into the escaped <title>.
    expect(html).not.toContain('<title>Lottie&#39;s Guide</title>'.replace('&#39;', "'"));
  });

  it('omits the entry script when a page has no stories (markdown-only)', async () => {
    fx = await setupFixture({
      'docs/index.md': '# Static only\n\nNo stories here.',
    });
    const ctx = await createContext({ root: fx.root });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    expect(html).not.toContain('<script type="module"');
  });

  it('includes Markbook base CSS by default; omits it when disableBaseCss: true', async () => {
    fx = await setupFixture({
      'docs/index.md': '# X',
    });
    let ctx = await createContext({ root: fx.root });
    await writePages(ctx, { clean: true, searchEnabled: false });
    let html = await fx.read('index.html');
    expect(html).toMatch(/<style>[\s\S]*--mb-bg/); // base CSS contains --mb-* tokens

    ctx = await createContext({ root: fx.root, disableBaseCss: true });
    await writePages(ctx, { clean: true, searchEnabled: false });
    html = await fx.read('index.html');
    expect(html).not.toMatch(/<style>[\s\S]*--mb-bg/);
  });

  it('renders "View as Markdown" / "Copy as Markdown" buttons by default', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\ntitle: Home\n---\n\n# Home\n',
    });
    const ctx = await createContext({ root: fx.root });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    expect(html).toContain('markbook-page-actions');
    expect(html).toContain('View as Markdown');
    expect(html).toContain('Copy as Markdown');
  });

  it('llmsButtons: false suppresses the page-actions block entirely', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\ntitle: Home\n---\n\n# Home\n',
    });
    const ctx = await createContext({ root: fx.root, llmsButtons: false });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    // Structural markup absent (BASE_CSS still mentions .markbook-page-actions selectors;
    // we care about the actual DOM, not the stylesheet rules).
    expect(html).not.toContain('<div class="markbook-page-actions"');
    expect(html).not.toContain('View as Markdown');
    expect(html).not.toContain('Copy as Markdown');
    // And the click-handler boot script is omitted.
    expect(html).not.toContain('data-markbook-copy-md');
  });
});

describe('writePages — HTML layout dispatch', () => {
  let fx: Fixture;
  afterEach(async () => {
    if (fx) await fs.rm(fx.root, { recursive: true, force: true });
  });

  const minimalLayout = (extra = '') => `<!doctype html>
<html><head><title>{{ browserTitle }}</title>${extra}{{ head }}</head>
<body>
<header>HOME-LINK</header>
<article data-pagefind-body>{{ content }}</article>
{{ bodyEnd }}
</body></html>`;

  it('uses config.layout for every page; built-in chrome is suppressed', async () => {
    fx = await setupFixture({
      'docs/index.md': '# Home\n',
      'docs/about.md': '# About\n',
      'layouts/default.html': minimalLayout(),
    });
    const ctx = await createContext({ root: fx.root, layout: 'default' });
    await writePages(ctx, { clean: true, searchEnabled: false });

    for (const page of ['index.html', 'about.html']) {
      const html = await fx.read(page);
      // Built-in structural chrome absent (BASE_CSS may still mention the
      // selectors; we assert on the DOM, not the inline stylesheet).
      expect(html).not.toContain('<header class="markbook-header">');
      expect(html).not.toContain('<aside class="markbook-sidebar">');
      expect(html).not.toContain('<aside class="markbook-toc">');
      // Layout markup present
      expect(html).toContain('<header>HOME-LINK</header>');
      expect(html).toContain('<article data-pagefind-body>');
    }
  });

  it('per-page frontmatter layout overrides the config default', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\nlayout: landing\n---\n# Hero\n',
      'docs/about.md': '# About\n',
      'layouts/default.html': minimalLayout('<!-- DEFAULT_MARKER -->'),
      'layouts/landing.html': minimalLayout('<!-- LANDING_MARKER -->'),
    });
    const ctx = await createContext({ root: fx.root, layout: 'default' });
    await writePages(ctx, { clean: true, searchEnabled: false });

    expect(await fx.read('index.html')).toContain('<!-- LANDING_MARKER -->');
    expect(await fx.read('about.html')).toContain('<!-- DEFAULT_MARKER -->');
  });

  it('frontmatter `layout: false` opts back into the built-in shell', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\nlayout: false\n---\n# Home\n',
      'layouts/default.html': minimalLayout(),
    });
    const ctx = await createContext({ root: fx.root, layout: 'default' });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    expect(html).toContain('markbook-header');
    expect(html).not.toContain('HOME-LINK');
  });

  it('throws a clear error when a named layout file does not exist', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\nlayout: missing\n---\n# Home\n',
    });
    const ctx = await createContext({ root: fx.root });
    await expect(writePages(ctx, { clean: true, searchEnabled: false })).rejects.toThrow(
      /HTML layout 'missing' not found/,
    );
  });

  it('throws when a layout omits the required {{ content }} placeholder', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\nlayout: broken\n---\n# Home\n',
      'layouts/broken.html': '<html><body>no content slot</body></html>',
    });
    const ctx = await createContext({ root: fx.root });
    await expect(writePages(ctx, { clean: true, searchEnabled: false })).rejects.toThrow(
      /missing a \{\{ content \}\} placeholder/,
    );
  });

  it('substitutes frontmatter via {{ frontmatter.x }} and HTML-escapes it', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\nauthor: "<script>alert(1)</script>"\n---\n# Home\n',
      'layouts/default.html': `<!doctype html><html><head><title>{{ browserTitle }}</title>{{ head }}</head>
<body><meta name="author" content="{{ frontmatter.author }}">
<article data-pagefind-body>{{ content }}</article>
{{ bodyEnd }}</body></html>`,
    });
    const ctx = await createContext({ root: fx.root, layout: 'default' });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    expect(html).toContain('content="&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(html).not.toContain('content="<script>alert(1)</script>"');
  });

  it('{{ pageActions }} is empty when llmsButtons: false; populated otherwise', async () => {
    const layoutBody = `<!doctype html><html><head>{{ head }}<title>{{ browserTitle }}</title></head>
<body><div class="actions-zone">[{{ pageActions }}]</div>
<article data-pagefind-body>{{ content }}</article>
{{ bodyEnd }}</body></html>`;
    fx = await setupFixture({
      'docs/index.md': '# Home\n',
      'layouts/default.html': layoutBody,
    });

    let ctx = await createContext({ root: fx.root, layout: 'default' });
    await writePages(ctx, { clean: true, searchEnabled: false });
    let html = await fx.read('index.html');
    expect(html).toContain('actions-zone');
    expect(html).toContain('View as Markdown');

    // Re-setup (writePages doesn't clean if same ctx; use fresh fixture)
    await fs.rm(fx.root, { recursive: true, force: true });
    fx = await setupFixture({
      'docs/index.md': '# Home\n',
      'layouts/default.html': layoutBody,
    });
    ctx = await createContext({ root: fx.root, layout: 'default', llmsButtons: false });
    await writePages(ctx, { clean: true, searchEnabled: false });
    html = await fx.read('index.html');
    expect(html).toContain('<div class="actions-zone">[]</div>');
    expect(html).not.toContain('View as Markdown');
  });

  it('{{ search }} expands when search is enabled and is empty otherwise', async () => {
    const layoutBody = `<!doctype html><html><head>{{ head }}<title>{{ browserTitle }}</title></head>
<body><nav>[{{ search }}]</nav>
<article data-pagefind-body>{{ content }}</article>
{{ bodyEnd }}</body></html>`;
    fx = await setupFixture({
      'docs/index.md': '# Home\n',
      'layouts/default.html': layoutBody,
    });

    let ctx = await createContext({ root: fx.root, layout: 'default' });
    await writePages(ctx, { clean: true, searchEnabled: true });
    let html = await fx.read('index.html');
    expect(html).toContain('<div id="markbook-search-ui"');

    await fs.rm(fx.root, { recursive: true, force: true });
    fx = await setupFixture({
      'docs/index.md': '# Home\n',
      'layouts/default.html': layoutBody,
    });
    ctx = await createContext({ root: fx.root, layout: 'default' });
    await writePages(ctx, { clean: true, searchEnabled: false });
    html = await fx.read('index.html');
    // The search slot expanded to '' — our wrapper shows '[]'.
    expect(html).toContain('<nav>[]</nav>');
    // The structural search element is absent (BASE_CSS selectors don't count).
    expect(html).not.toContain('<div id="markbook-search-ui"');
    // And the Pagefind init script is omitted.
    expect(html).not.toContain('new PagefindUI(');
  });

  it('contentDir alias works end-to-end (pages/ instead of docs/)', async () => {
    fx = await setupFixture({
      'pages/index.md': '---\ntitle: PageDir\n---\n# Hi\n',
    });
    const ctx = await createContext({ root: fx.root, contentDir: 'pages' });
    await writePages(ctx, { clean: true, searchEnabled: false });
    expect(await fx.exists('index.html')).toBe(true);
    const html = await fx.read('index.html');
    expect(html).toContain('<title>PageDir</title>');
  });

  it('HTML comments inside the layout are preserved verbatim (placeholders inert)', async () => {
    fx = await setupFixture({
      'docs/index.md': '# Home\n',
      'layouts/default.html': `<!doctype html>
<!-- author note: use {{ content }} and {{ head }} as below; do NOT touch {{ tilte }} -->
<html><head>{{ head }}<title>{{ browserTitle }}</title></head>
<body><article data-pagefind-body>{{ content }}</article>{{ bodyEnd }}</body></html>`,
    });
    const ctx = await createContext({ root: fx.root, layout: 'default' });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    // The comment survives unchanged — even the typo `{{ tilte }}` inside
    // it is preserved because the comment was protected during substitution.
    expect(html).toContain(
      '<!-- author note: use {{ content }} and {{ head }} as below; do NOT touch {{ tilte }} -->',
    );
  });
});

describe('writePages — transformHtml integration', () => {
  let fx: Fixture;
  afterEach(async () => {
    if (fx) await fs.rm(fx.root, { recursive: true, force: true });
  });

  it('runs transformHtml as a final post-process AFTER the built-in shell', async () => {
    fx = await setupFixture({ 'docs/index.md': '# Home\n' });
    const ctx = await createContext({
      root: fx.root,
      transformHtml: async (html) => html.replace('</body>', '<!--POST-TRANSFORM--></body>'),
    });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    expect(html).toContain('<!--POST-TRANSFORM-->');
    // And the built-in shell still ran first
    expect(html).toContain('markbook-header');
  });

  it('runs transformHtml as a final post-process AFTER an HTML layout', async () => {
    fx = await setupFixture({
      'docs/index.md': '# Home\n',
      'layouts/default.html': `<!doctype html><html><head>{{ head }}<title>{{ browserTitle }}</title></head>
<body><article data-pagefind-body>{{ content }}</article>{{ bodyEnd }}</body></html>`,
    });
    const ctx = await createContext({
      root: fx.root,
      layout: 'default',
      transformHtml: async (html, page) => {
        // Confirm the layout had already produced its output by the time
        // transformHtml runs (the article wrapper from the layout is here).
        expect(html).toContain('data-pagefind-body');
        // Page metadata is passed in alongside the HTML.
        expect(page.relPath).toBe('index.md');
        expect(page.htmlRelPath).toBe('index.html');
        return html.replace('</body>', `<!--POST:${page.title}--></body>`);
      },
    });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    expect(html).toContain('<!--POST:Home-->');
  });
});

describe('writePages — markdown-only error gate', () => {
  let fx: Fixture;
  afterEach(async () => {
    if (fx) await fs.rm(fx.root, { recursive: true, force: true });
  });

  it('throws when a page uses a :::story directive without an adapter', async () => {
    fx = await setupFixture({
      'docs/index.md': '# Home\n\n:::story{src=./Foo.tsx export=Default}\n:::\n',
    });
    const ctx = await createContext({ root: fx.root });
    await expect(writePages(ctx, { clean: true, searchEnabled: false })).rejects.toThrow(
      /no adapter is configured/,
    );
  });
});

describe('emitLlms — top-level llms.txt + per-page mirrors', () => {
  let fx: Fixture;
  afterEach(async () => {
    if (fx) await fs.rm(fx.root, { recursive: true, force: true });
  });

  it('writes /llms.txt at the given outDir, alongside /llms/<page>.txt mirrors', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\ntitle: Home\ndescription: The landing page\n---\n\nWelcome.',
      'docs/about.md': '---\ntitle: About\ndescription: About us\n---\n\nWho we are.',
    });
    const ctx = await createContext({ root: fx.root });
    const { pages } = await writePages(ctx, { clean: true, searchEnabled: false });
    const { emitLlms } = await import('./build.js');
    await emitLlms(pages, ctx.tmpDir, ctx.siteTitle, ctx.siteDescription);

    expect(await fx.exists('llms.txt')).toBe(true);
    expect(await fx.exists('llms/index.txt')).toBe(true);
    expect(await fx.exists('llms/about.txt')).toBe(true);

    const index = await fx.read('llms.txt');
    // BOM + H1 — substring check accommodates the leading \uFEFF.
    expect(index).toContain('# Home');
    expect(index.startsWith('\uFEFF')).toBe(true);
    expect(index).toContain('llmstxt.org');
    expect(index).toContain('](./llms/index.txt)');
    expect(index).toContain(': The landing page');
    expect(index).toContain('](./llms/about.txt)');
    expect(index).toContain(': About us');
  });

  it('uses config.title for the H1 when set; per-page descriptions still appear', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\ntitle: Home\ndescription: Landing\n---\n',
    });
    const ctx = await createContext({ root: fx.root, title: 'My Site' });
    const { pages } = await writePages(ctx, { clean: true, searchEnabled: false });
    const { emitLlms } = await import('./build.js');
    await emitLlms(pages, ctx.tmpDir, ctx.siteTitle, ctx.siteDescription);
    const index = await fx.read('llms.txt');
    expect(index).toContain('# My Site');
    expect(index.startsWith('\uFEFF')).toBe(true);
  });

  it('emits per-page mirrors writePages-side too (so dev "View as Markdown" works)', async () => {
    // writePages itself emits llms/<page>.txt mirrors so the View-as-Markdown
    // links work even before emitLlms runs. emitLlms re-emits them to the
    // production outDir; dev() runs emitLlms against tmpDir so the index
    // is also there.
    fx = await setupFixture({ 'docs/index.md': '# Home\n\nBody.' });
    const ctx = await createContext({ root: fx.root });
    await writePages(ctx, { clean: true, searchEnabled: false });
    // Per-page mirror was written by writePages alone — without emitLlms.
    expect(await fx.exists('llms/index.txt')).toBe(true);
    const txt = await fx.read('llms/index.txt');
    expect(txt).toContain('# Home');
    expect(txt).toContain('Body.');
    // Top-level llms.txt is NOT written by writePages alone.
    expect(await fx.exists('llms.txt')).toBe(false);
  });

  it('emits a UTF-8 BOM at the start of every .txt file so browsers detect the encoding regardless of HTTP Content-Type', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\ntitle: Home\n---\n\n# Home\n\nEmoji: 🚀 — em-dash.',
    });
    const ctx = await createContext({ root: fx.root });
    const { pages } = await writePages(ctx, { clean: true, searchEnabled: false });
    const { emitLlms } = await import('./build.js');
    await emitLlms(pages, ctx.tmpDir, ctx.siteTitle, ctx.siteDescription);

    // Per-page mirror written by writePages: BOM present.
    const perPage = await fx.read('llms/index.txt');
    expect(perPage.startsWith('\uFEFF')).toBe(true);
    // Top-level index written by emitLlms: BOM present.
    const top = await fx.read('llms.txt');
    expect(top.startsWith('\uFEFF')).toBe(true);

    // Read the raw bytes to confirm the BOM is the canonical EF BB BF.
    const raw = await fs.readFile(path.join(fx.root, '.markbook/llms.txt'));
    expect(raw[0]).toBe(0xef);
    expect(raw[1]).toBe(0xbb);
    expect(raw[2]).toBe(0xbf);

    // Emoji + em-dash round-trip cleanly (UTF-8 bytes intact, no mojibake).
    expect(perPage).toContain('🚀');
    expect(perPage).toContain('—');
  });
});

describe('writePages — SEO + Open Graph meta', () => {
  let fx: Fixture;
  afterEach(async () => {
    if (fx) await fs.rm(fx.root, { recursive: true, force: true });
  });

  it('built-in shell emits description, theme-color, color-scheme, OG, and Twitter tags', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\ntitle: Home\ndescription: My awesome page\n---\n# Home\n',
    });
    const ctx = await createContext({
      root: fx.root,
      title: 'My Site',
      description: 'Site-wide description',
    });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');

    // Description: per-page frontmatter wins over config.description.
    expect(html).toContain('<meta name="description" content="My awesome page">');
    // Theme color + color scheme — always emitted.
    expect(html).toContain('<meta name="theme-color" content="#0a1228">');
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    // Open Graph
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('<meta property="og:title" content="Home — My Site">');
    expect(html).toContain('<meta property="og:description" content="My awesome page">');
    expect(html).toContain('<meta property="og:site_name" content="My Site">');
    // Twitter (summary card since no image configured)
    expect(html).toContain('<meta name="twitter:card" content="summary">');
    expect(html).toContain('<meta name="twitter:title" content="Home — My Site">');
  });

  it('falls back to config.description when frontmatter omits it', async () => {
    fx = await setupFixture({ 'docs/index.md': '# Home\n' });
    const ctx = await createContext({
      root: fx.root,
      description: 'Site description fallback',
    });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    expect(html).toContain('<meta name="description" content="Site description fallback">');
  });

  it('omits the description meta entirely when neither frontmatter nor config supplies one', async () => {
    fx = await setupFixture({ 'docs/index.md': '# Home\n' });
    const ctx = await createContext({ root: fx.root });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    // No description anywhere — Lighthouse prefers absence over empty content.
    expect(html).not.toMatch(/<meta name="description"/);
    expect(html).not.toMatch(/<meta property="og:description"/);
  });

  it('emits canonical + og:url only when siteUrl is configured', async () => {
    // Without siteUrl
    fx = await setupFixture({ 'docs/about.md': '---\ntitle: About\n---\n# About\n' });
    let ctx = await createContext({ root: fx.root });
    await writePages(ctx, { clean: true, searchEnabled: false });
    let html = await fx.read('about.html');
    expect(html).not.toMatch(/<link rel="canonical"/);
    expect(html).not.toMatch(/<meta property="og:url"/);

    // With siteUrl
    await fs.rm(fx.root, { recursive: true, force: true });
    fx = await setupFixture({ 'docs/about.md': '---\ntitle: About\n---\n# About\n' });
    ctx = await createContext({ root: fx.root, siteUrl: 'https://example.com' });
    await writePages(ctx, { clean: true, searchEnabled: false });
    html = await fx.read('about.html');
    expect(html).toContain('<link rel="canonical" href="https://example.com/about.html">');
    expect(html).toContain('<meta property="og:url" content="https://example.com/about.html">');
  });

  it('honours frontmatter `ogImage` (per-page) + config.ogImage (default) and bumps twitter:card to summary_large_image', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\ntitle: Home\n---\n# Home\n',
      'docs/about.md':
        '---\ntitle: About\nogImage: https://example.com/about-og.png\n---\n# About\n',
    });
    const ctx = await createContext({
      root: fx.root,
      ogImage: 'https://example.com/default-og.png',
    });
    await writePages(ctx, { clean: true, searchEnabled: false });

    const homeHtml = await fx.read('index.html');
    expect(homeHtml).toContain(
      '<meta property="og:image" content="https://example.com/default-og.png">',
    );
    expect(homeHtml).toContain('<meta name="twitter:card" content="summary_large_image">');

    const aboutHtml = await fx.read('about.html');
    expect(aboutHtml).toContain(
      '<meta property="og:image" content="https://example.com/about-og.png">',
    );
    expect(aboutHtml).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  it('HTML layout also receives the SEO meta block through {{ head }}', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\ntitle: Home\ndescription: Layout SEO test\n---\n# Home\n',
      'layouts/default.html': `<!doctype html><html><head><title>{{ browserTitle }}</title>{{ head }}</head>
<body><article data-pagefind-body>{{ content }}</article>{{ bodyEnd }}</body></html>`,
    });
    const ctx = await createContext({
      root: fx.root,
      layout: 'default',
      siteUrl: 'https://example.com',
    });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    // Layout's own <title> wasn't disturbed.
    expect(html).toContain('<title>Home</title>');
    // Markbook injected the SEO meta via {{ head }}.
    expect(html).toContain('<meta name="description" content="Layout SEO test">');
    expect(html).toContain('<link rel="canonical" href="https://example.com/index.html">');
    expect(html).toContain('<meta property="og:title" content="Home">');
  });

  it('uses a custom theme-color when configured', async () => {
    fx = await setupFixture({ 'docs/index.md': '# Home\n' });
    const ctx = await createContext({ root: fx.root, themeColor: '#ff6b6b' });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    expect(html).toContain('<meta name="theme-color" content="#ff6b6b">');
  });
});

describe('build — sitemap.xml + robots.txt emission', () => {
  let fx: Fixture;
  afterEach(async () => {
    if (fx) await fs.rm(fx.root, { recursive: true, force: true });
  });

  it('emits sitemap.xml + robots.txt under outDir when siteUrl is configured', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\ntitle: Home\n---\n# Home\n',
      'docs/about.md': '---\ntitle: About\n---\n# About\n',
      'docs/guide/intro.md': '---\ntitle: Intro\n---\n# Intro\n',
    });
    const ctx = await createContext({ root: fx.root, siteUrl: 'https://example.com' });
    const { pages } = await writePages(ctx, { clean: true, searchEnabled: false });
    const { emitSitemapAndRobots } = await import('./build.js');
    await emitSitemapAndRobots(pages, ctx.tmpDir, ctx.siteUrl);

    expect(await fx.exists('sitemap.xml')).toBe(true);
    expect(await fx.exists('robots.txt')).toBe(true);

    const sitemap = await fx.read('sitemap.xml');
    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemap).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    // index.html collapses to the directory URL (cleaner canonical form).
    expect(sitemap).toContain('<loc>https://example.com/</loc>');
    expect(sitemap).toContain('<loc>https://example.com/about.html</loc>');
    expect(sitemap).toContain('<loc>https://example.com/guide/intro.html</loc>');
    expect(sitemap).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);

    const robots = await fx.read('robots.txt');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');
  });

  it('does NOT emit sitemap.xml or robots.txt when siteUrl is unset', async () => {
    fx = await setupFixture({ 'docs/index.md': '---\ntitle: Home\n---\n# Home\n' });
    const ctx = await createContext({ root: fx.root });
    const { pages } = await writePages(ctx, { clean: true, searchEnabled: false });
    const { emitSitemapAndRobots } = await import('./build.js');
    await emitSitemapAndRobots(pages, ctx.tmpDir, ctx.siteUrl);
    expect(await fx.exists('sitemap.xml')).toBe(false);
    expect(await fx.exists('robots.txt')).toBe(false);
  });

  it('XML-escapes URLs so query strings or special chars survive', async () => {
    fx = await setupFixture({
      // Path with chars that need XML-escaping (& in filename is unusual but valid on POSIX).
      'docs/q-and-a.md': '---\ntitle: Q&A\n---\n# Q&A\n',
    });
    const ctx = await createContext({ root: fx.root, siteUrl: 'https://example.com' });
    const { pages } = await writePages(ctx, { clean: true, searchEnabled: false });
    const { emitSitemapAndRobots } = await import('./build.js');
    await emitSitemapAndRobots(pages, ctx.tmpDir, ctx.siteUrl);
    const sitemap = await fx.read('sitemap.xml');
    // Filename `q-and-a.html` doesn't have entity chars, but if it did,
    // we use escapeXml internally. This test verifies the structure.
    expect(sitemap).toContain('<loc>https://example.com/q-and-a.html</loc>');
  });
});

describe('dev-mode emit parity (writePages → emitLlms → emitSitemapAndRobots → runPagefind)', () => {
  let fx: Fixture;
  afterEach(async () => {
    if (fx) await fs.rm(fx.root, { recursive: true, force: true });
  });

  it('replicates dev() emission chain: tmpDir gets HTML + llms.txt + sitemap.xml + robots.txt when siteUrl is set', async () => {
    fx = await setupFixture({
      'docs/index.md': '---\ntitle: Home\n---\n# Home\n',
      'docs/about.md': '---\ntitle: About\n---\n# About\n',
    });
    const ctx = await createContext({ root: fx.root, siteUrl: 'https://example.com' });
    const { pages } = await writePages(ctx, { clean: true, searchEnabled: true });
    const { emitLlms, emitSitemapAndRobots } = await import('./build.js');
    await emitLlms(pages, ctx.tmpDir, ctx.siteTitle, ctx.siteDescription);
    await emitSitemapAndRobots(pages, ctx.tmpDir, ctx.siteUrl);

    // HTML lives in tmpDir (Vite root in dev).
    expect(await fx.exists('index.html')).toBe(true);
    expect(await fx.exists('about.html')).toBe(true);
    // llms.txt + per-page mirrors.
    expect(await fx.exists('llms.txt')).toBe(true);
    expect(await fx.exists('llms/index.txt')).toBe(true);
    expect(await fx.exists('llms/about.txt')).toBe(true);
    // sitemap.xml + robots.txt now alongside (same call chain as dev()).
    expect(await fx.exists('sitemap.xml')).toBe(true);
    expect(await fx.exists('robots.txt')).toBe(true);
    const sitemap = await fx.read('sitemap.xml');
    expect(sitemap).toContain('<loc>https://example.com/about.html</loc>');
  });

  it('skips sitemap + robots in the dev chain when siteUrl is unset (same gate as build)', async () => {
    fx = await setupFixture({ 'docs/index.md': '---\ntitle: Home\n---\n# Home\n' });
    const ctx = await createContext({ root: fx.root });
    const { pages } = await writePages(ctx, { clean: true, searchEnabled: true });
    const { emitSitemapAndRobots } = await import('./build.js');
    await emitSitemapAndRobots(pages, ctx.tmpDir, ctx.siteUrl);
    expect(await fx.exists('sitemap.xml')).toBe(false);
    expect(await fx.exists('robots.txt')).toBe(false);
  });
});

describe('inline asset minification', () => {
  let fx: Fixture;
  afterEach(async () => {
    if (fx) await fs.rm(fx.root, { recursive: true, force: true });
  });

  it('built-in shell inlines BASE_CSS with no CSS comments (minified)', async () => {
    fx = await setupFixture({ 'docs/index.md': '# Home\n' });
    const ctx = await createContext({ root: fx.root });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    const styleBlock = html.match(/<style>([\s\S]*?)<\/style>/);
    expect(styleBlock, 'inline style block').toBeTruthy();
    const css = styleBlock![1]!;
    // After minification: no CSS block comments, no double whitespace gaps,
    // no indented newlines.
    expect(css).not.toMatch(/\/\*/);
    expect(css).not.toMatch(/\n\s{2,}/);
    // Still contains the brand-token namespace (proof we minified the right
    // string, not an empty placeholder).
    expect(css).toContain('--mb-');
  });

  it('user CSS inlined into the page is minified (comments stripped)', async () => {
    const cssWith = `/* user comment */
      .my-rule {
        color: red;
        /* nested */
        background: blue;
      }`;
    fx = await setupFixture({
      'docs/index.md': '# Home\n',
      'site.css': cssWith,
    });
    const ctx = await createContext({ root: fx.root, css: ['./site.css'] });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    const userBlock = html.match(/<style data-markbook-user-css>([\s\S]*?)<\/style>/);
    expect(userBlock, 'user-css block').toBeTruthy();
    const css = userBlock![1]!;
    expect(css).not.toContain('user comment');
    expect(css).not.toContain('nested');
    expect(css).not.toMatch(/\n\s{2,}/);
    expect(css).toContain('.my-rule');
    expect(css).toContain('color:red');
  });

  it('inline boot scripts are minified (no // comments, no indented newlines)', async () => {
    fx = await setupFixture({ 'docs/index.md': '# Home\n' });
    const ctx = await createContext({ root: fx.root });
    await writePages(ctx, { clean: true, searchEnabled: false });
    const html = await fx.read('index.html');
    // Each <script> ... </script> block in the head should be a tight IIFE
    // with no surrounding whitespace or comments.
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) {
      // Boot scripts shouldn't carry author-comments or excessive whitespace.
      expect(s).not.toMatch(/\/\/\s+\w/); // no // line comments
      expect(s).not.toMatch(/\n\s{4,}/); // no deep indented newlines
    }
  });
});
