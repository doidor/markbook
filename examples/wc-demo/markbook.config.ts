import { defineConfig } from '@markbook/core';
import { wcAdapter } from '@markbook/adapter-wc/config';

export default defineConfig({
  title: 'Web Components demo',
  description:
    'Minimal Markbook site validating @markbook/adapter-wc — vanilla custom elements, no framework runtime.',
  docsDir: 'docs',
  outDir: 'dist',
  adapter: wcAdapter(),
});
