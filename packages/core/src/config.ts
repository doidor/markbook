export interface MarkbookAdapter {
  packageName: string;
  vitePlugins?: () => unknown[] | Promise<unknown[]>;
  /**
   * Path (relative to project root) of a module whose default export is a
   * component that receives `{ children }` and wraps every story before mount.
   * Use this for global providers (theme, i18n, router, ...).
   */
  wrapperModule?: string;
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
  adapter: MarkbookAdapter;
}

export function defineConfig(config: MarkbookConfig): MarkbookConfig {
  return config;
}
