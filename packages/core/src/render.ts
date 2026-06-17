import path from 'node:path';
import { escapeHtml, escapeAttribute } from './directive-utils.js';
import { stringify } from './placeholder.js';
import { getInlineAssets } from './assets.js';
import { applyHtmlLayout, type HtmlLayoutSubstitutions } from './template.js';
import { canonicalPageUrl } from './sitemap.js';
import type { PageRecord, BuildContext } from './build.js';
import type { NavGroup } from './nav.js';

/**
 * Per-page HTML rendering: assembles the `PageRenderContext`, the built-in
 * Markbook shell, the SEO/head/body-end injections, and the user-HTML-layout
 * path. Kept separate from `build.ts`'s orchestration so the chrome markup
 * lives in one place.
 */

/**
 * Bundle the data that's reused across the built-in shell and HTML
 * layouts when rendering a single page. Computed once per page in
 * `writePages`, then passed into `renderBuiltinShell` / `renderLayout`.
 */
export interface PageRenderContext {
  page: PageRecord;
  nav: NavGroup[];
  siteTitle: string | null;
  entryBasename: string | null;
  searchEnabled: boolean;
  userCss: string;
  disableBaseCss: boolean;
  llmsButtons: boolean;
  /** Site-wide description (frontmatter overrides per-page). */
  siteDescription: string | undefined;
  /** Canonical site origin (no trailing slash), or null if not configured. */
  siteUrl: string | null;
  /** `<meta name="theme-color">` value. */
  themeColor: string;
  /** Default Open Graph image URL, or null if not configured. */
  defaultOgImage: string | null;
  /** Function that rewrites a `target` path (e.g. `index.html`) to a relative href from this page. */
  resolveHref: (target: string) => string;
  /** Relative path from this page to `pagefind/` (no trailing slash). */
  pagefindBase: string;
  /** Effective browser-tab title for this page. */
  browserTitle: string;
  /** What goes in the header brand on the built-in shell. */
  brandText: string;
  /** Effective page description (frontmatter > config.description > ''). */
  effectiveDescription: string;
  /** Effective Open Graph image URL (frontmatter `ogImage` > config.ogImage > null). */
  effectiveOgImage: string | null;
  /** Canonical absolute URL for this page if `siteUrl` is set, else null. */
  canonicalUrl: string | null;
}

export function buildPageRenderContext(
  page: PageRecord,
  nav: NavGroup[],
  ctx: BuildContext,
  entryBasename: string | null,
  searchEnabled: boolean,
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
  // Avoid `Foo — Foo` when the page title already equals the site title
  // (common on the homepage). Only append the site title as a suffix when it
  // differs from the page title.
  const browserTitle =
    ctx.siteTitle && ctx.siteTitle !== pageTitle ? `${pageTitle} — ${ctx.siteTitle}` : pageTitle;
  const brandText = ctx.siteTitle ?? pageTitle;

  // Description / OG image: per-page frontmatter wins, falls back to config.
  const fmDescription =
    typeof page.parsed.frontmatter.description === 'string'
      ? page.parsed.frontmatter.description
      : undefined;
  const effectiveDescription = fmDescription ?? ctx.siteDescription ?? '';
  const fmOgImage =
    typeof page.parsed.frontmatter.ogImage === 'string'
      ? page.parsed.frontmatter.ogImage
      : undefined;
  const effectiveOgImage = fmOgImage ?? ctx.ogImage;

  // Canonical URL — only emit when siteUrl is set. `index.html` collapses to
  // its directory URL (matching sitemap.xml) so the homepage canonical is
  // `https://site.com/`, not `…/index.html`.
  const canonicalUrl = ctx.siteUrl ? canonicalPageUrl(ctx.siteUrl, page.htmlRelPath) : null;

  return {
    page,
    nav,
    siteTitle: ctx.siteTitle,
    entryBasename,
    searchEnabled,
    userCss: ctx.userCss,
    disableBaseCss: ctx.disableBaseCss,
    llmsButtons: ctx.llmsButtons,
    siteDescription: ctx.siteDescription,
    siteUrl: ctx.siteUrl,
    themeColor: ctx.themeColor,
    defaultOgImage: ctx.ogImage,
    resolveHref,
    pagefindBase,
    browserTitle,
    brandText,
    effectiveDescription,
    effectiveOgImage,
    canonicalUrl,
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
function buildHeadInjections(
  prc: PageRenderContext,
  opts: { skipDescriptionMeta?: boolean } = {},
): string {
  const assets = getInlineAssets();
  const pagefindLink = prc.searchEnabled
    ? `<link href="${prc.pagefindBase}/pagefind-ui.css" rel="stylesheet">`
    : '';
  const parts = [
    `<script>${assets.themeBoot}</script>`,
    `<script>${assets.tabsBoot}</script>`,
    `<script>${assets.playgroundBoot}</script>`,
    `<script>${assets.copyBoot}</script>`,
    `<script>${assets.permalinkBoot}</script>`,
    `<script>${assets.navToggleBoot}</script>`,
  ];
  if (prc.llmsButtons) parts.push(`<script>${assets.copyMdBoot}</script>`);
  if (prc.searchEnabled) parts.push(`<script>${assets.searchKbdBoot}</script>`);
  if (pagefindLink) parts.push(pagefindLink);
  if (!prc.disableBaseCss) parts.push(`<style>${assets.baseCss}</style>`);
  if (prc.userCss) parts.push(`<style data-markbook-user-css>${prc.userCss}</style>`);
  // SEO + browser-chrome meta. Always emitted; per-page values come from
  // the PageRenderContext (frontmatter > config defaults).
  parts.push(buildSeoMeta(prc, opts));
  return parts.join('\n');
}

/**
 * Build the SEO / Open Graph / Twitter Card / theme-color meta block.
 * Lives inside `{{ head }}` so layouts get it automatically, and the
 * built-in shell gets it too (its `<head>` template embeds head
 * injections directly).
 *
 * Per-page values cascade frontmatter > config defaults. Tags that
 * require a canonical URL (canonical, og:url) are emitted only when
 * `siteUrl` is set in the config.
 *
 * `skipDescriptionMeta` suppresses the plain `<meta name="description">` when
 * the HTML layout already provides its own (avoids a duplicate tag). The
 * `og:`/`twitter:description` variants are always emitted — layouts rarely
 * hand-write those.
 */
function buildSeoMeta(
  prc: PageRenderContext,
  opts: { skipDescriptionMeta?: boolean } = {},
): string {
  const lines: string[] = [];
  // Per-page description — first-class SEO requirement. Skip if empty
  // (don't emit `<meta content="">` — Lighthouse flags it as "no
  // description").
  if (prc.effectiveDescription && !opts.skipDescriptionMeta) {
    lines.push(`<meta name="description" content="${escapeAttribute(prc.effectiveDescription)}">`);
  }
  // Browser chrome tinting + dark-mode hint. theme-color works on mobile
  // browsers + PWAs; color-scheme tells the browser which native form
  // controls / scrollbars to use.
  lines.push(`<meta name="theme-color" content="${escapeAttribute(prc.themeColor)}">`);
  lines.push('<meta name="color-scheme" content="light dark">');
  // Canonical + og:url only when siteUrl is set (otherwise we'd emit a
  // relative-path canonical, which Lighthouse flags).
  if (prc.canonicalUrl) {
    lines.push(`<link rel="canonical" href="${escapeAttribute(prc.canonicalUrl)}">`);
  }
  // Open Graph — required (or strongly recommended) properties.
  lines.push('<meta property="og:type" content="website">');
  lines.push(`<meta property="og:title" content="${escapeAttribute(prc.browserTitle)}">`);
  if (prc.effectiveDescription) {
    lines.push(
      `<meta property="og:description" content="${escapeAttribute(prc.effectiveDescription)}">`,
    );
  }
  if (prc.siteTitle) {
    lines.push(`<meta property="og:site_name" content="${escapeAttribute(prc.siteTitle)}">`);
  }
  if (prc.canonicalUrl) {
    lines.push(`<meta property="og:url" content="${escapeAttribute(prc.canonicalUrl)}">`);
  }
  if (prc.effectiveOgImage) {
    lines.push(`<meta property="og:image" content="${escapeAttribute(prc.effectiveOgImage)}">`);
  }
  // Twitter Card — picks up og:* fallback automatically, but explicit
  // tags rank higher in Twitter's preview UI.
  lines.push(
    `<meta name="twitter:card" content="${prc.effectiveOgImage ? 'summary_large_image' : 'summary'}">`,
  );
  lines.push(`<meta name="twitter:title" content="${escapeAttribute(prc.browserTitle)}">`);
  if (prc.effectiveDescription) {
    lines.push(
      `<meta name="twitter:description" content="${escapeAttribute(prc.effectiveDescription)}">`,
    );
  }
  if (prc.effectiveOgImage) {
    lines.push(`<meta name="twitter:image" content="${escapeAttribute(prc.effectiveOgImage)}">`);
  }
  return lines.join('\n');
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
 * The mobile hamburger button. Visible via CSS only at narrow viewports
 * (`@media (max-width: 700px)`). Clicking toggles the `data-markbook-nav-open`
 * attribute on `<body>`, which makes the sidebar slide in. Wired to
 * `aria-controls="markbook-sidebar"` so the sidebar id needs to match.
 */
function buildNavToggle(): string {
  return `<button class="markbook-nav-toggle" type="button" data-markbook-nav-toggle aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="markbook-sidebar"><span class="markbook-icon-menu" aria-hidden>☰</span><span class="markbook-icon-close" aria-hidden>✕</span></button>`;
}

/**
 * Render a page using the built-in Markbook shell (header + sidebar + TOC).
 * Used when no HTML layout is configured for the page.
 */
export function renderBuiltinShell(prc: PageRenderContext): string {
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
  const navToggle = buildNavToggle();
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
  ${navToggle}
  <a class="markbook-brand" href="${homeHref}"><span class="markbook-logo" aria-hidden>📘</span> ${escapeHtml(prc.brandText)}</a>
  ${searchSlot}
  ${themeToggle}
</header>
<div class="${shellClass}">
  <aside class="markbook-sidebar" id="markbook-sidebar">
    <nav class="markbook-nav" aria-label="Site">${navHtml}</nav>
  </aside>
  <main class="markbook-main">
    <article class="markbook-content" data-pagefind-body>
${pageActions}${prc.page.parsed.html}
    </article>
  </main>
  ${tocBlock}
</div>
<div class="markbook-nav-backdrop" data-markbook-nav-backdrop aria-hidden="true"></div>
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
/**
 * Matches a `<meta name="description" …>` tag in a raw layout body (before
 * placeholder substitution). Used to avoid emitting Markbook's own
 * description meta when the layout already provides one. Deliberately strict:
 * `name="description"` only — `og:description` / `twitter:description` use
 * different attribute names and never collide.
 */
const LAYOUT_DESCRIPTION_META = /<meta\s+[^>]*name=["']description["']/i;

export function renderLayout(
  prc: PageRenderContext,
  layoutName: string,
  layoutBody: string,
): string {
  const layoutHasDescriptionMeta = LAYOUT_DESCRIPTION_META.test(layoutBody);
  const subs: HtmlLayoutSubstitutions = {
    raw: {
      content: prc.page.parsed.html,
      head: buildHeadInjections(prc, { skipDescriptionMeta: layoutHasDescriptionMeta }),
      bodyEnd: buildBodyEndInjections(prc),
      pageActions: prc.llmsButtons ? renderPageActions(prc.page, prc.resolveHref) : '',
      search: buildSearchSlot(prc),
      themeToggle: buildThemeToggle(),
    },
    text: {
      title: prc.page.parsed.title,
      description: stringify(prc.page.parsed.frontmatter.description),
      siteTitle: prc.siteTitle ?? '',
      browserTitle: prc.browserTitle,
    },
  };
  return applyHtmlLayout(layoutBody, subs, prc.page.parsed.frontmatter, layoutName);
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
