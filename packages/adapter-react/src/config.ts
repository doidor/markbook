import reactPlugin from '@vitejs/plugin-react';
import type { MarkbookAdapter } from '@doidor/markbook-core';

export interface ReactAdapterOptions {
  /**
   * Paths (relative to project root, or absolute) of decorator modules. Each
   * module's default export is a React component that receives `{ children }`
   * and wraps the story before mount. Decorators are applied outer-to-inner:
   * `['./theme.tsx', './i18n.tsx']` produces `<Theme><I18n><Story /></I18n></Theme>`.
   * Use for stacked global providers.
   */
  decorators?: string[];
}

export function reactAdapter(opts: ReactAdapterOptions = {}): MarkbookAdapter {
  return {
    packageName: '@doidor/markbook-adapter-react',
    vitePlugins: () => reactPlugin() as unknown[],
    decoratorModules: opts.decorators,
    packagePeerDeps: ['react', 'react-dom'],
    hasControls: true,
  };
}
