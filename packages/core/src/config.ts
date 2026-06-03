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
  adapter: MarkbookAdapter;
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
}

export function defineConfig(config: MarkbookConfig): MarkbookConfig {
  return config;
}
