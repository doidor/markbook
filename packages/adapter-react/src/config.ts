import reactPlugin from '@vitejs/plugin-react';
import type { MarkbookAdapter } from '@markbook/core';

export interface ReactAdapterOptions {
  /**
   * Path (relative to project root) of a `.tsx`/`.ts`/`.jsx`/`.js` module
   * whose default export is a component receiving `{ children }` and wrapping
   * every story before mount. Use this for global providers — theme, i18n,
   * router, etc.
   */
  wrapper?: string;
}

export function reactAdapter(opts: ReactAdapterOptions = {}): MarkbookAdapter {
  return {
    packageName: '@markbook/adapter-react',
    vitePlugins: () => reactPlugin() as unknown[],
    wrapperModule: opts.wrapper,
    packagePeerDeps: ['react', 'react-dom'],
  };
}
