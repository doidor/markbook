import { defineConfig } from '@doidor/markbook-core';
import { reactAdapter } from '@doidor/markbook-adapter-react/config';

export default defineConfig({
  title: 'Pixie',
  description: 'Demo Markbook site built around the Pixie made-up component library.',
  docsDir: 'docs',
  outDir: 'dist',
  templatesDir: ['_layouts'],
  css: ['./markbook.css'],
  playground: {
    providers: ['codesandbox', 'stackblitz'],
    dependencies: { react: '18.3.1', 'react-dom': '18.3.1' },
    // Inline Pixie source into the sandbox so the story's
    // `'../../../src/pixie/Button.js'` imports actually resolve.
    inlineSourceImports: ['src/pixie/**/*'],
  },
  adapter: reactAdapter({ decorators: ['./preview.tsx'] }),
});
