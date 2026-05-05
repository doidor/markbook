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
}

export interface MarkbookConfig {
  root?: string;
  docsDir?: string;
  outDir?: string;
  title?: string;
  description?: string;
  /**
   * One or more directories (relative to root, or absolute) to search for page
   * templates. Searched in order; the first `<dir>/<name>.md` that exists wins.
   * Default: `'templates'`.
   */
  templatesDir?: string | string[];
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
  adapter: MarkbookAdapter;
}

export function defineConfig(config: MarkbookConfig): MarkbookConfig {
  return config;
}
