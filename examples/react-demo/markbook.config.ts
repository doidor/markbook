import { defineConfig } from '@markbook/core';
import { reactAdapter } from '@markbook/adapter-react/config';

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
  },
  adapter: reactAdapter({ decorators: ['./preview.tsx'] }),
});
