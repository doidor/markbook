import type { MarkbookAdapter } from '@markbook/core';

export function wcAdapter(): MarkbookAdapter {
  return {
    packageName: '@markbook/adapter-wc',
    packagePeerDeps: [],
  };
}
