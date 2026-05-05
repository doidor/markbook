import { defineConfig } from '@markbook/core';
import { vueAdapter } from '@markbook/adapter-vue/config';

export default defineConfig({
  title: 'Vue demo',
  description: 'Minimal Markbook site validating @markbook/adapter-vue.',
  docsDir: 'docs',
  outDir: 'dist',
  adapter: vueAdapter(),
});
