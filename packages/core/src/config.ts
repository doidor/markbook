export interface MarkbookAdapter {
  packageName: string;
  vitePlugins?: () => unknown[] | Promise<unknown[]>;
  /**
   * Paths (relative to project root, or absolute) of decorator modules.
   * Each module's default export must be a component that receives
   * `{ children }` (or a default slot, for Vue) and wraps the story before
   * mount. Decorators are applied **outer-to-inner**: `[A, B]` produces
   * `<A><B><Story /></B></A>`. Use this for stacked global providers (theme,
   * i18n, router, ...).
   */
  decoratorModules?: string[];
  /**
   * In `--mode package` bundles, these dependencies stay external (declared as
   * peer dependencies on the published package). For React: `['react',
   * 'react-dom']`; for Vue: `['vue']`; for vanilla web components: `[]`.
   * Embed-mode bundles ignore this — they always inline everything.
   */
  packagePeerDeps?: string[];
  /**
   * When `true`, the adapter exports `setupControls(controlsEl, args, argTypes,
   * onChange)` from its main entry, and the entry generator wires interactive
   * prop controls per story whose source exports `args`. Currently only the
   * React adapter sets this.
   */
  hasControls?: boolean;
  /**
   * Internal marker. Set by `staticAdapter()` (the default when no adapter
   * is configured) to enable a clear error when a markdown-only site tries
   * to use a `:::story` / `:::stories` directive.
   */
  isStatic?: boolean;
}

/**
 * Default adapter for markdown-only sites — no Vite plugins, no decorators,
 * no controls. Markbook uses this implicitly when `MarkbookConfig.adapter`
 * is omitted. If a page tries to use `:::story` / `:::stories` directives
 * with this adapter, the builder throws a clear error pointing at the
 * framework-specific adapters (`reactAdapter`, `vueAdapter`, `wcAdapter`).
 */
export function staticAdapter(): MarkbookAdapter {
  return {
    packageName: '@markbook/core',
    isStatic: true,
  };
}

export interface MarkbookConfig {
  root?: string;
  /**
   * Directory (relative to `root`) where Markbook reads markdown content
   * pages from. Defaults to `'docs'` for backward compatibility. Use
   * whatever name fits your site — `'pages'`, `'content'`, `'src'`, etc.
   *
   * `docsDir` is a legacy alias retained for backward compatibility. If
   * both `contentDir` and `docsDir` are set, Markbook throws — pick one.
   */
  contentDir?: string;
  /** Legacy alias for {@link contentDir}. Kept for backward compatibility. */
  docsDir?: string;
  outDir?: string;
  /**
   * Directory (relative to `root`, or absolute) of static assets that get
   * copied verbatim to the build output's root. Files placed here are also
   * served at `/` during `markbook dev`. The default is `'public'` — match
   * the conventional name used by Vite, Next, Astro, etc.
   *
   * Use this for OG images (`/og.png`), favicons, font files, robots-style
   * static files, or anything else you want hosted alongside your built
   * site without going through Markbook's markdown pipeline.
   *
   * Set `publicDir: false` to disable entirely (no public directory is
   * looked for or served). Backed by Vite's own `publicDir` so behaviour
   * matches what users expect from other static-site tools.
   */
  publicDir?: string | false;
  title?: string;
  description?: string;
  /**
   * Canonical site origin for the deployed site, e.g. `'https://cumulus.example'`.
   * When set, Markbook emits:
   *
   *   - `<link rel="canonical">` per page.
   *   - `<meta property="og:url">` per page.
   *   - `dist/sitemap.xml` listing every page.
   *   - `dist/robots.txt` referencing the sitemap.
   *
   * Should NOT include a trailing slash; Markbook normalizes it. When unset,
   * Markbook skips canonical / `og:url` / sitemap / robots — pages still get
   * Open Graph + Twitter cards without URL fields.
   */
  siteUrl?: string;
  /**
   * Browser theme color (`<meta name="theme-color">`) — picked up by mobile
   * browsers for window chrome and PWA app-icon backgrounds. Accepts any
   * CSS color string. Defaults to `'#0a1228'` (matches the built-in shell's
   * dark background); override for branded sites.
   */
  themeColor?: string;
  /**
   * Default Open Graph / Twitter card image URL, used when a page doesn't
   * supply `ogImage` in frontmatter. Should be an absolute URL (Markbook
   * does NOT prepend `siteUrl` — embed the full URL yourself so the same
   * default works whether the site is deployed at the root or a sub-path).
   */
  ogImage?: string;
  /**
   * One or more directories (relative to root, or absolute) to search for page
   * templates. Searched in order; the first `<dir>/<name>.md` that exists wins.
   * Default: `'templates'`.
   */
  templatesDir?: string | string[];
  /**
   * One or more directories (relative to root, or absolute) to search for HTML
   * layouts. Searched in order; the first `<dir>/<name>.html` that exists wins.
   * Default: `'layouts'`.
   *
   * Layouts REPLACE Markbook's built-in HTML shell — they let you write the
   * `<html>...</html>` structure yourself, with `{{ }}` placeholders for the
   * page content and Markbook-required injections. Pick a layout per-page via
   * frontmatter (`layout: <name>`) or for every page via {@link layout}.
   *
   * Layouts are the modern, file-based alternative to writing string-mutation
   * `transformHtml` callbacks. See the customization section of the README.
   */
  layoutsDir?: string | string[];
  /**
   * Name of an HTML layout (under {@link layoutsDir}, without the `.html`
   * extension) to apply to every page by default. Individual pages can
   * override via frontmatter `layout: <other-name>`, or opt out with
   * `layout: false` to fall back to Markbook's built-in shell.
   *
   * When unset, pages render with the built-in shell unless their own
   * frontmatter names a layout.
   */
  layout?: string;
  /** Options for `markbook dev`. */
  dev?: {
    /** Port to bind the dev server to. Defaults to Vite's default (5173). */
    port?: number;
    /** Host to bind to. */
    host?: string;
  };
  /** Options for `markbook bundle`. */
  bundle?: {
    /** npm scope for `--mode package` outputs. e.g. `'@my-org'`. */
    packageScope?: string;
    /** Version written into generated `package.json` files. Default `'0.0.1'`. */
    packageVersion?: string;
  };
  /**
   * Paths (relative to project root, or absolute) of CSS files inlined into
   * every generated page after Markbook's built-in styles. Use this to override
   * `--mb-*` tokens, drop in Tailwind output, or add brand styles. Watched in
   * `markbook dev` — edits trigger a full reload.
   */
  css?: string | string[];
  /**
   * When `true`, Markbook's built-in chrome stylesheet is **not** inlined. Use
   * with `css` to take full control of the chrome's look — the placeholder
   * element classes (`.markbook-*`) and `data-*` attributes remain stable, but
   * you provide every rule yourself.
   */
  disableBaseCss?: boolean;
  /**
   * Optional async transform that runs against each page's fully-generated
   * HTML. Receives the page metadata so per-page decisions are possible. Use
   * when CSS isn't enough — inject scripts, restructure DOM, swap header
   * markup.
   */
  transformHtml?: (
    html: string,
    page: {
      relPath: string;
      htmlRelPath: string;
      title: string;
      frontmatter: Record<string, unknown>;
    },
  ) => string | Promise<string>;
  /**
   * "Open in playground" integration. When set, each rendered story-block
   * gets a button that opens the story source in CodeSandbox and/or
   * StackBlitz. React-only for now.
   *
   * Known limitation: story files that import in-repo modules (e.g.
   * `'../../../src/MyComponent.js'`) produce sandboxes with broken imports.
   * For real-world component libraries published to npm this works as-is;
   * for in-repo demo code the resulting sandbox shows the source and lets
   * the reader rewrite the imports themselves.
   */
  playground?: PlaygroundConfig | false;
  /**
   * Whether to show "View as Markdown" / "Copy as Markdown" action buttons
   * on every page (just below the H1). The buttons link to / fetch the
   * per-page `llms/<path>.txt` mirror. Default: `true`. Set to `false` to
   * suppress.
   */
  llmsButtons?: boolean;
  /**
   * Markbook ships with an internal `staticAdapter()` (no framework, no
   * Vite plugins) for markdown-only sites. Supply an explicit adapter
   * (`reactAdapter`, `vueAdapter`, `wcAdapter`) when pages use `:::story`
   * or `:::stories` directives — Markbook throws a clear error if a page
   * tries to mount stories without one.
   */
  adapter?: MarkbookAdapter;
}

export type PlaygroundProvider = 'codesandbox' | 'stackblitz';

export interface PlaygroundConfig {
  /**
   * Which providers to offer buttons for. Pass a single provider for one
   * button, or an array of two (`['codesandbox', 'stackblitz']`) for both.
   */
  providers: PlaygroundProvider | PlaygroundProvider[];
  /**
   * Dependencies declared in the generated `package.json`. For React
   * stories, defaults to `{ react: 'latest', 'react-dom': 'latest' }` when
   * omitted.
   */
  dependencies?: Record<string, string>;
  /**
   * StackBlitz template. Defaults to `'create-react-app'` for React stories.
   * See https://developer.stackblitz.com/docs/platform/post-api/ for the
   * full list.
   */
  stackblitzTemplate?: string;
  /**
   * Glob patterns (relative to `MarkbookConfig.root`, or absolute) of source
   * files eligible for inlining into the sandbox. When set, Markbook walks
   * each story file's relative imports and — if they resolve to a file
   * matched by one of these globs — includes the file's source in the
   * sandbox payload (and recurses into ITS imports). Use this for monorepo
   * setups where stories import from in-repo source that isn't published on
   * npm. Without it, those imports stay broken in the sandbox.
   *
   * Each file lands at `src/<path-relative-to-root>` in the sandbox so the
   * original relative-import paths resolve unchanged.
   */
  inlineSourceImports?: string[];
}

export function defineConfig(config: MarkbookConfig): MarkbookConfig {
  return config;
}
