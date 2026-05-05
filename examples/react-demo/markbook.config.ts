import { defineConfig } from '@markbook/core';
import { reactAdapter } from '@markbook/adapter-react/config';

export default defineConfig({
  title: 'Pixie',
  description: 'Demo Markbook site built around the Pixie made-up component library.',
  docsDir: 'docs',
  outDir: 'dist',
  templatesDir: ['_layouts'],
  adapter: reactAdapter({ decorators: ['./preview.tsx'] }),
});
