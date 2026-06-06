import vuePlugin from '@vitejs/plugin-vue';
import type { MarkbookAdapter } from '@markbook/core';

export function vueAdapter(): MarkbookAdapter {
  return {
    packageName: '@markbook/adapter-vue',
    vitePlugins: () => [vuePlugin()] as unknown[],
    packagePeerDeps: ['vue'],
    hasControls: true,
  };
}
