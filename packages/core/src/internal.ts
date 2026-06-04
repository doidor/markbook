/**
 * Internal API surface for `@markbook/core`.
 *
 * Everything re-exported here is reachable through
 * `@markbook/core/internal`. It exists for power users (custom build
 * pipelines, alternative CLIs, advanced tooling), tests, and downstream
 * Markbook packages. Signatures here may change at any minor release —
 * stick to the main entry (`@markbook/core`) for stability.
 */

// Markdown + directive parsing
export { parseMarkdown } from './parse.js';
export type {
  ParsedPage,
  StoryRef,
  HeadingRef,
  ParseOptions,
  StoryCodeFile,
} from './parse.js';

// Story-file source extraction (Shiki-highlighted disclosure)
export { extractStoryCode, invalidateCodeCache } from './code.js';
export type { CodeFile } from './code.js';

// Component prop-table extraction (React types via react-docgen-typescript)
export { extractComponentProps } from './props.js';

// Template (Markdown shell) substitution
export { applyTemplate, applyHtmlLayout } from './template.js';
export type {
  HtmlLayoutSubstitutions,
  HtmlLayoutRawToken,
  HtmlLayoutTextToken,
} from './template.js';

// TS-AST export discovery for `:::stories` fan-out
export {
  discoverStoryExports,
  invalidateExportsCache,
  kebabExportName,
  humanizeExportName,
} from './exports.js';

// Build/dev plumbing — context creation, template loader, nav helpers,
// llms.txt + Pagefind emitters (the last two are exported for advanced
// pipelines that want to call them outside the bundled build()/dev()).
export {
  createContext,
  makeLoadTemplate,
  makeLoadHtmlLayout,
  resolvePageLayout,
  emitLlms,
  emitSitemapAndRobots,
  normalizeSiteUrl,
  runPagefind,
  sortIndexFirst,
  isIndexHref,
  capitalize,
} from './build.js';
export type { BuildContext, NavItem, NavGroup } from './build.js';

// Embed-bundle slug derivation
export { slugify } from './embed.js';
