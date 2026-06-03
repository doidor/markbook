/**
 * Public API surface for `@markbook/core`.
 *
 * What ships here is the contract Markbook keeps stable across patch
 * releases: the config function + types, the three orchestration entry
 * points (`build`, `dev`, `bundleEmbed`), and the adapter contract that
 * framework packages target.
 *
 * Internal helpers (`parseMarkdown`, `extractStoryCode`, slug helpers,
 * nav/AST utilities, cache invalidators, etc.) are reachable via the
 * `@markbook/core/internal` subpath. They're public enough to write tools
 * against, but their signatures may change at any minor release.
 */

export { defineConfig } from './config.js';
export type { MarkbookConfig, MarkbookAdapter } from './config.js';

export { build, dev } from './build.js';
export { bundleEmbed } from './embed.js';
export type { BundleEmbedOptions, BundleMode, BundleIsolation } from './embed.js';
