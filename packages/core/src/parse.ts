import path from 'node:path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSlug from 'rehype-slug';
import { SKIP, visit } from 'unist-util-visit';
import type { DirectiveHandler, DirectiveResult } from './config.js';
import { applyTemplate } from './template.js';
import { humanizeExportName } from './exports.js';
import { resolveSpec } from './resolve.js';
import { highlightFencedCodeBlocks } from './fenced-code.js';
import { copyButton } from './code-block.js';
import { escapeHtml } from './directive-utils.js';

export interface StoryCodeFile {
  label: string;
  lang: string;
  code: string;
  codeHtml: string;
}

export interface StoryRef {
  id: string;
  src: string;
  exportName: string;
  /**
   * User-provided embed slug from the directive's `id=` attribute. Stable
   * across file moves. For `:::stories` fan-outs this is the GROUP base; the
   * per-story slug is `${slug}-${kebab(exportName)}`.
   */
  slug?: string;
  /**
   * Set when the story came from a `:::stories` fan-out — used downstream to
   * promote the embed slug with the export name (so multiple exports from the
   * same file don't collide and so adding a second export later doesn't
   * silently rename the original embed).
   */
  groupId?: string;
  /**
   * Story source plus any CSS files it imports directly. The first entry is
   * always the story file itself.
   */
  codeFiles?: StoryCodeFile[];
}

export interface HeadingRef {
  level: number;
  text: string;
  slug: string;
}

export interface ParsedPage {
  frontmatter: Record<string, unknown>;
  html: string;
  plainText: string;
  plainMarkdown: string;
  stories: StoryRef[];
  headings: HeadingRef[];
  title: string;
  /**
   * Absolute paths of files user-directive handlers reported reading.
   * Used by `markbook dev` to re-render the page when any of those files
   * change. Empty for pages without user directives.
   */
  directiveDependencies: string[];
}

export interface ParseOptions {
  pageFile: string;
  resolveStoryCode?: (info: {
    absStoryFile: string;
    exportName: string;
  }) => Promise<{ files: StoryCodeFile[] } | null>;
  resolveStoryExports?: (absStoryFile: string) => Promise<string[] | null>;
  resolveProps?: (info: {
    absComponentFile: string;
    exportName?: string;
  }) => Promise<{ tableHtml: string; tableMarkdown: string } | null>;
  /** Returns the raw text of a template file given its `<name>` (no extension). */
  loadTemplate?: (name: string) => Promise<string>;
  /**
   * Optional hook that returns extra HTML to inject inside each story-block
   * (e.g. "Open in playground" buttons). Called once per StoryRef after the
   * story's `codeFiles` have been resolved. Return `''` to skip. Can be
   * async — file I/O is fine here.
   */
  renderStoryExtras?: (story: StoryRef) => string | Promise<string>;
  /**
   * User-defined directive handlers, keyed by directive name. Pre-validated
   * (built-in name collisions rejected) by `createContext`. Pass the raw
   * `config.directives` value through — the dispatcher handles both the
   * function shorthand and the `{ type, handler }` descriptor form.
   */
  userDirectives?: Record<string, import('./config.js').DirectiveHandler>;
  /** Project root — passed into the handler context. */
  root?: string;
}

interface BaseSlot {
  parent: { children: unknown[] };
  /** Current index in parent.children at the moment the directive was visited. */
  index: number;
  start: number;
  end: number;
}

interface StorySlot extends BaseSlot {
  kind: 'story';
  story: StoryRef;
}

interface StoriesSlot extends BaseSlot {
  kind: 'stories';
  groupId: string;
  stories: StoryRef[];
}

interface PropsSlot extends BaseSlot {
  kind: 'props';
}

interface UserDirectiveSlot extends BaseSlot {
  kind: 'user';
  /** Resolved replacement HTML, populated in the async phase before splicing. */
  html: string;
  /**
   * Markdown to substitute in the per-page `llms/<page>.txt` mirror.
   * `undefined` means "keep the original directive source unchanged."
   */
  markdownReplacement: string | undefined;
  /** Files this handler reported reading; rolled into the page's dependency set. */
  dependencies: string[];
}

type DirectiveSlot = StorySlot | StoriesSlot | PropsSlot | UserDirectiveSlot;

export async function parseMarkdown(
  source: string,
  fileId: string,
  options: ParseOptions,
): Promise<ParsedPage> {
  const { pageFile, resolveStoryCode, resolveStoryExports, resolveProps } = options;
  const pageDir = path.dirname(pageFile);

  const { data, content: rawContent } = matter(source);
  const frontmatter = data as Record<string, unknown>;

  let content = rawContent;
  if (typeof frontmatter.template === 'string' && options.loadTemplate) {
    const templateRaw = await options.loadTemplate(frontmatter.template);
    const { content: templateBody } = matter(templateRaw);
    content = applyTemplate(rawContent, frontmatter, templateBody);
  }

  const componentPath = (() => {
    const spec = frontmatter.component;
    if (typeof spec !== 'string') return undefined;
    const resolved = resolveSpec(spec, pageDir);
    return resolved ?? undefined;
  })();
  const componentExport =
    typeof frontmatter.componentExport === 'string' ? frontmatter.componentExport : undefined;

  const stories: StoryRef[] = [];
  const headings: HeadingRef[] = [];
  const slots: DirectiveSlot[] = [];
  let storyCounter = 0;
  let groupCounter = 0;
  let propsTableMarkdown: string | undefined;

  // Pending tasks for `:::stories` fan-out — collected during the visit
  // because the visit callback is sync but export discovery is async. We
  // resolve them all together before slot replacement.
  interface PendingStoriesTask {
    slot: StoriesSlot;
    src: string;
    absStoryFile: string;
    userSlug?: string;
    only?: string[];
    exclude?: string[];
  }
  const pendingStoriesTasks: PendingStoriesTask[] = [];

  // Pending user-directive tasks — same async-after-visit pattern. We
  // capture a snapshot of the node + its source position so we can render
  // children to HTML (for container directives) and call the user handler.
  interface PendingUserDirectiveTask {
    slot: UserDirectiveSlot;
    name: string;
    handler: DirectiveHandler;
    formInSource: 'leaf' | 'container';
    attributes: Record<string, string | undefined>;
    childrenSnapshot: unknown[];
    line?: number;
    column?: number;
  }
  const pendingUserDirectiveTasks: PendingUserDirectiveTask[] = [];

  const userDirectives = options.userDirectives ?? {};

  // Shared context for resolving nested user directives inside container
  // bodies. `content` (not the raw `source`) is the offset base — the mdast
  // is parsed from `content`, so node positions index into it.
  const nestedDirectiveDependencies: string[] = [];
  const nestedDirectiveContext: NestedDirectiveContext = {
    userDirectives,
    content,
    pageFile,
    root: options.root ?? path.dirname(pageFile),
    frontmatter,
    dependencies: nestedDirectiveDependencies,
  };

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(() => async (tree: unknown) => {
      visit(tree as never, (node: any, index, parent: any) => {
        if (!parent || typeof index !== 'number') return;
        // Markbook recognizes both leaf (`::name{...}`) and container
        // (`:::name{...}\n...\n:::`) directives. Built-ins are container-only.
        if (node.type !== 'containerDirective' && node.type !== 'leafDirective') return;
        const isContainer = node.type === 'containerDirective';

        const start = node.position?.start?.offset ?? 0;
        const end = node.position?.end?.offset ?? 0;

        // Built-ins first — they take precedence over user directives.
        if (
          isContainer &&
          (node.name === 'story' || node.name === 'stories' || node.name === 'props')
        ) {
          if (node.name === 'story') {
            const attrs = (node.attributes ?? {}) as Record<string, string | undefined>;
            const src = attrs.src;
            const exportName = attrs.export ?? 'default';
            const userSlug = typeof attrs.id === 'string' ? attrs.id : undefined;
            if (!src) return;
            const id = `${fileId}--${storyCounter++}`;
            const story: StoryRef = { id, src, exportName, slug: userSlug };
            stories.push(story);
            slots.push({ kind: 'story', parent, index, start, end, story });
          } else if (node.name === 'stories') {
            const attrs = (node.attributes ?? {}) as Record<string, string | undefined>;
            const src = attrs.src;
            if (!src) return;
            const userSlug = typeof attrs.id === 'string' ? attrs.id : undefined;
            const only = parseNameList(attrs.only);
            const exclude = parseNameList(attrs.exclude);
            const groupId = `${fileId}--g${groupCounter++}`;
            const slot: StoriesSlot = {
              kind: 'stories',
              parent,
              index,
              start,
              end,
              groupId,
              stories: [],
            };
            slots.push(slot);
            const absStoryFile = resolveSpec(src, pageDir);
            if (absStoryFile === null) {
              throw new Error(
                `Markbook: \`:::stories{src=${src}}\` could not be resolved from ${pageDir}. ` +
                  `Use a relative path (\`./\` or \`../\`) or install the bare-specifier package.`,
              );
            }
            pendingStoriesTasks.push({
              slot,
              src,
              absStoryFile,
              userSlug,
              only,
              exclude,
            });
          } else {
            slots.push({ kind: 'props', parent, index, start, end });
          }
          // Built-in container bodies are not re-scanned for directives.
          return SKIP;
        }

        // User directives — registered via config.directives.
        const handler = userDirectives[node.name as string];
        if (!handler) return;

        const attrs = (node.attributes ?? {}) as Record<string, string | undefined>;
        // Validate pinned `type` against actual source form (clearer error
        // than silently letting the handler see an unexpected innerHtml).
        const actualForm: 'leaf' | 'container' = isContainer ? 'container' : 'leaf';
        validatePinnedType(
          handler,
          node.name as string,
          actualForm,
          pageFile,
          node.position?.start,
        );

        // Pre-allocate the slot — `html` / `markdownReplacement` are filled
        // after the user handler resolves in the async pass below.
        const slot: UserDirectiveSlot = {
          kind: 'user',
          parent,
          index,
          start,
          end,
          html: '',
          markdownReplacement: undefined,
          dependencies: [],
        };
        slots.push(slot);
        pendingUserDirectiveTasks.push({
          slot,
          name: node.name as string,
          handler,
          formInSource: actualForm,
          attributes: attrs,
          childrenSnapshot: isContainer ? (node.children ?? []) : [],
          line: node.position?.start?.line,
          column: node.position?.start?.column,
        });
        // Claimed container: its body is resolved (incl. nested user
        // directives) when we compute `innerHtml` below — don't let `visit`
        // descend and create overlapping top-level slots for those nested
        // directives.
        if (isContainer) return SKIP;
      });

      // Fan out `:::stories` slots first — they create StoryRefs that the
      // subsequent code-resolution loop iterates over.
      if (pendingStoriesTasks.length > 0) {
        if (!resolveStoryExports) {
          throw new Error(
            'Markbook: `:::stories` directive used but no `resolveStoryExports` callback was provided to parseMarkdown.',
          );
        }
        for (const task of pendingStoriesTasks) {
          const discovered = await resolveStoryExports(task.absStoryFile);
          if (!discovered) {
            throw new Error(
              `Markbook: \`:::stories\` directive points at '${task.src}' which could not be read.`,
            );
          }
          let names = discovered;
          if (task.only && task.only.length > 0) {
            const allow = new Set(task.only);
            for (const n of task.only) {
              if (!discovered.includes(n)) {
                throw new Error(
                  `Markbook: \`:::stories\` only=${task.only.join(',')} but '${n}' is not an export of '${task.src}'. Found: [${discovered.join(', ')}]`,
                );
              }
            }
            names = names.filter((n) => allow.has(n));
          }
          if (task.exclude && task.exclude.length > 0) {
            const deny = new Set(task.exclude);
            names = names.filter((n) => !deny.has(n));
          }
          if (names.length === 0) {
            throw new Error(
              `Markbook: \`:::stories\` directive for '${task.src}' resolved to zero exports after filtering.`,
            );
          }
          for (const exportName of names) {
            const id = `${fileId}--${storyCounter++}`;
            const story: StoryRef = {
              id,
              src: task.src,
              exportName,
              slug: task.userSlug,
              groupId: task.slot.groupId,
            };
            stories.push(story);
            task.slot.stories.push(story);
          }
        }
      }

      const tasks: Array<Promise<void>> = [];

      if (resolveStoryCode) {
        // Dedup by (file, export) so multi-export files slice each export
        // only once even when referenced from multiple `:::story` directives.
        const seen = new Map<string, Promise<{ files: StoryCodeFile[] } | null>>();
        for (const story of stories) {
          const absStoryFile = resolveSpec(story.src, pageDir);
          if (!absStoryFile) continue;
          const cacheKey = `${absStoryFile}::${story.exportName}`;
          if (!seen.has(cacheKey)) {
            seen.set(cacheKey, resolveStoryCode({ absStoryFile, exportName: story.exportName }));
          }
          tasks.push(
            (async () => {
              const result = await seen.get(cacheKey)!;
              if (result) story.codeFiles = result.files;
            })(),
          );
        }
      }

      let propsTableHtml: string | undefined;
      const hasPropsSlot = slots.some((s) => s.kind === 'props');
      if (hasPropsSlot && componentPath && resolveProps) {
        tasks.push(
          (async () => {
            const result = await resolveProps({
              absComponentFile: componentPath,
              exportName: componentExport,
            });
            if (result) {
              propsTableHtml = result.tableHtml;
              propsTableMarkdown = result.tableMarkdown;
            }
          })(),
        );
      }

      await Promise.all(tasks);

      // Resolve user directives in parallel. Each handler may render
      // children to HTML, may do file I/O, may be async — all good.
      // Errors get a clear file:line prefix and chain the original via
      // `Error.cause`.
      if (pendingUserDirectiveTasks.length > 0) {
        await Promise.all(
          pendingUserDirectiveTasks.map(async (task) => {
            let innerHtml: string | null = null;
            let innerMarkdown: string | null = null;
            if (task.formInSource === 'container') {
              const inner = await resolveContainerInner(
                task.childrenSnapshot,
                task.slot.start,
                task.slot.end,
                nestedDirectiveContext,
              );
              innerHtml = inner.html;
              innerMarkdown = inner.markdown;
            }
            const out = await runDirectiveHandler({
              name: task.name,
              handler: task.handler,
              type: task.formInSource,
              attributes: task.attributes,
              innerHtml,
              innerMarkdown,
              pageFile,
              root: options.root ?? path.dirname(pageFile),
              frontmatter,
              line: task.line,
              column: task.column,
            });
            task.slot.html = out.html;
            if (out.markdownReplacement !== undefined) {
              task.slot.markdownReplacement = out.markdownReplacement;
            }
            task.slot.dependencies = out.dependencies;
          }),
        );
      }

      // Resolve story extras (e.g. "Open in playground" buttons) AFTER
      // codeFiles is populated — the renderer typically needs the source.
      // We store the result on each story so slot rendering stays sync.
      const extrasMap = new Map<string, string>();
      if (options.renderStoryExtras) {
        const renderer = options.renderStoryExtras;
        await Promise.all(
          stories.map(async (story) => {
            const html = await renderer(story);
            if (html) extrasMap.set(story.id, html);
          }),
        );
      }

      // Splice in descending source order so earlier slots' indexes are not
      // shifted by later replacements in the same parent.
      const orderedSlots = [...slots].sort((a, b) => b.start - a.start);
      for (const slot of orderedSlots) {
        const replacement = buildSlotReplacement(slot, propsTableHtml, extrasMap);
        slot.parent.children.splice(slot.index, 1, ...(replacement as never[]));
      }
    })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(() => async (tree: unknown) => {
      await highlightFencedCodeBlocks(tree);
    })
    .use(() => (tree: unknown) => {
      visit(tree as never, 'element', (node: any) => {
        if (typeof node.tagName !== 'string') return;
        const m = /^h([1-6])$/.exec(node.tagName);
        if (!m) return;
        const level = parseInt(m[1] ?? '0', 10);
        if (level < 1 || level > 3) return;
        const text = textOf(node);
        const slug = (node.properties?.id as string | undefined) ?? slugify(text);
        headings.push({ level, text, slug });

        // Append a hover-revealed permalink to H2/H3 (skip H1 — only one per
        // page, the URL fragment is implicit). Clicking copies the
        // canonical anchor URL via PERMALINK_BOOT_SCRIPT.
        //
        // `data-pagefind-ignore="all"` keeps the literal `#` glyph out of
        // both the search index AND the search-result excerpts (Pagefind
        // requires the explicit `"all"` value — an empty string is treated
        // as unset).
        if (level === 2 || level === 3) {
          const anchor = {
            type: 'element',
            tagName: 'a',
            properties: {
              href: `#${slug}`,
              className: ['markbook-heading-anchor'],
              'aria-label': `Permalink to ${text}`,
              'data-markbook-permalink': '',
              'data-pagefind-ignore': 'all',
            },
            children: [{ type: 'text', value: '#' }],
          };
          if (!Array.isArray(node.children)) node.children = [];
          node.children.push(anchor);
        }
      });
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content);

  const html = String(file);
  const plainText = htmlToPlainText(html);
  const plainMarkdown = buildPlainMarkdown(content, slots, propsTableMarkdown).trim();

  const fmTitle = typeof frontmatter.title === 'string' ? frontmatter.title : undefined;
  const h1Text = headings.find((h) => h.level === 1)?.text;
  const title = fmTitle ?? h1Text ?? fileId;

  // Roll user-directive dependencies up into a deduped list for the watcher.
  // Includes deps reported by nested directives inside container bodies.
  const directiveDependencies = [
    ...new Set([
      ...slots.flatMap((s) => (s.kind === 'user' ? s.dependencies : [])),
      ...nestedDirectiveDependencies,
    ]),
  ];

  return {
    frontmatter,
    html,
    plainText,
    plainMarkdown,
    stories,
    headings,
    title,
    directiveDependencies,
  };
}

/**
 * Context threaded through nested user-directive resolution inside container
 * bodies. `content` is the offset base (the mdast is parsed from it, so node
 * positions index into it). `dependencies` accumulates absolute file paths
 * reported by nested handlers so they roll up into the page's watch set.
 */
interface NestedDirectiveContext {
  userDirectives: Record<string, DirectiveHandler>;
  content: string;
  pageFile: string;
  root: string;
  frontmatter: Record<string, unknown>;
  dependencies: string[];
}

/**
 * One nested directive's markdown substitution: replace the directive's raw
 * source span (`[start, end)`, absolute offsets into `content`) with `markdown`
 * — its handler's `markdown` fallback, or the raw source when the handler
 * provides none (mirrors the top-level `buildPlainMarkdown` contract).
 */
interface MarkdownSub {
  start: number;
  end: number;
  markdown: string;
}

/** Inner HTML + inner markdown of a container, both with nested directives resolved. */
interface ResolvedInner {
  html: string;
  markdown: string;
}

/**
 * Resolve a container directive's children once and return BOTH views: the
 * inner HTML (nested handlers' `html`, for `innerHtml`) and the inner markdown
 * (nested handlers' `markdown` fallback substituted into the raw source, for
 * `innerMarkdown`). Nested USER directives (leaf or container, any depth) run
 * exactly once; a nested container resolves its own inner views first, so a
 * handler that builds its markdown from `innerMarkdown` composes recursively.
 * Built-in directives (`story` / `stories` / `props`) never run when nested.
 */
async function resolveContainerInner(
  children: unknown[],
  start: number,
  end: number,
  ctx: NestedDirectiveContext,
): Promise<ResolvedInner> {
  const mdSubs: MarkdownSub[] = [];
  await resolveNestedUserDirectives(children, ctx, mdSubs);
  const html = await stringifyChildrenToHtml(children);
  const markdown = buildInnerMarkdown(ctx.content, start, end, mdSubs);
  return { html, markdown };
}

/**
 * Stringify mdast children (with nested directives already resolved to raw-html
 * nodes) into HTML using the same plugin stack the top-level pipeline uses.
 */
async function stringifyChildrenToHtml(children: unknown[]): Promise<string> {
  const processor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(() => async (tree: unknown) => {
      await highlightFencedCodeBlocks(tree);
    })
    .use(rehypeStringify, { allowDangerousHtml: true });
  const wrapper = { type: 'root', children };
  const hast = await processor.run(wrapper as never);
  return String(processor.stringify(hast)).trim();
}

/**
 * Walk a list of mdast nodes and replace every nested user-directive node
 * (leaf or container) with a raw-html node carrying its handler output, while
 * recording a `MarkdownSub` for each so the container's `innerMarkdown` gets
 * the handler's markdown fallback (not the raw `::name{...}` syntax).
 * Containers recurse (their inner views are resolved before the handler runs).
 * Unknown directives are left untouched but still descended into, so a
 * registered directive buried inside an unhandled wrapper still renders.
 */
async function resolveNestedUserDirectives(
  nodes: unknown[],
  ctx: NestedDirectiveContext,
  mdSubs: MarkdownSub[],
): Promise<void> {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i] as {
      type?: string;
      name?: string;
      attributes?: Record<string, string | undefined>;
      children?: unknown[];
      position?: {
        start?: { offset?: number; line?: number; column?: number };
        end?: { offset?: number };
      };
    } | null;
    if (!node || typeof node !== 'object') continue;

    const isContainer = node.type === 'containerDirective';
    const isLeaf = node.type === 'leafDirective';
    if (isContainer || isLeaf) {
      const name = node.name ?? '';
      // Built-ins never run nested — leave them as-is.
      const isBuiltin = name === 'story' || name === 'stories' || name === 'props';
      const handler = isBuiltin ? undefined : ctx.userDirectives[name];
      if (handler) {
        const actualForm: 'leaf' | 'container' = isContainer ? 'container' : 'leaf';
        validatePinnedType(handler, name, actualForm, ctx.pageFile, node.position?.start);
        const start = node.position?.start?.offset ?? 0;
        const end = node.position?.end?.offset ?? 0;
        let innerHtml: string | null = null;
        let innerMarkdown: string | null = null;
        if (isContainer) {
          const inner = await resolveContainerInner(node.children ?? [], start, end, ctx);
          innerHtml = inner.html;
          innerMarkdown = inner.markdown;
        }
        const out = await runDirectiveHandler({
          name,
          handler,
          type: actualForm,
          attributes: (node.attributes ?? {}) as Record<string, string | undefined>,
          innerHtml,
          innerMarkdown,
          pageFile: ctx.pageFile,
          root: ctx.root,
          frontmatter: ctx.frontmatter,
          line: node.position?.start?.line,
          column: node.position?.start?.column,
        });
        for (const dep of out.dependencies) ctx.dependencies.push(dep);
        nodes[i] = { type: 'html', value: out.html };
        // Record the markdown substitution for the enclosing container's
        // `innerMarkdown`. `undefined` => keep the raw directive source (same
        // contract as the top-level `buildPlainMarkdown`).
        mdSubs.push({
          start,
          end,
          markdown:
            out.markdownReplacement !== undefined
              ? out.markdownReplacement
              : ctx.content.slice(start, end),
        });
        continue;
      }
      // Unhandled directive — fall through to descend into its children.
    }

    if (Array.isArray(node.children)) {
      await resolveNestedUserDirectives(node.children, ctx, mdSubs);
    }
  }
}

/** Type-guard distinguishing the `{ type, handler }` descriptor form from the function shorthand. */
function isDirectiveDescriptor(
  h: import('./config.js').DirectiveHandler,
): h is import('./config.js').DirectiveHandlerDescriptor {
  return typeof h !== 'function' && typeof (h as { handler?: unknown }).handler === 'function';
}

/**
 * Throw with source position when a `{ type }`-pinned handler is used with
 * the wrong directive form (`::` leaf vs `:::` container). Shared by the
 * top-level visitor and nested resolution so the error is identical either
 * way.
 */
function validatePinnedType(
  handler: DirectiveHandler,
  name: string,
  actualForm: 'leaf' | 'container',
  pageFile: string,
  position: { line?: number; column?: number } | undefined,
): void {
  const descriptor = isDirectiveDescriptor(handler) ? handler : { handler };
  const pinned = descriptor.type;
  if (pinned && pinned !== actualForm) {
    throw new Error(
      `Markbook: directive '${name}' in ${pageFile}` +
        (position?.line ? `:${position.line}:${position.column ?? 0}` : '') +
        ` was written as ${actualForm} (${actualForm === 'leaf' ? '::' : ':::'}${name}…) but the handler is pinned to ${pinned}.`,
    );
  }
}

interface DirectiveInvocation {
  name: string;
  handler: DirectiveHandler;
  type: 'leaf' | 'container';
  attributes: Record<string, string | undefined>;
  innerHtml: string | null;
  innerMarkdown: string | null;
  pageFile: string;
  root: string;
  frontmatter: Record<string, unknown>;
  line?: number;
  column?: number;
}

interface DirectiveOutput {
  html: string;
  /** `undefined` => keep original source in the llms.txt mirror. */
  markdownReplacement: string | undefined;
  dependencies: string[];
}

/**
 * Call a user directive handler and normalize its return value (string /
 * `{ html, markdown, dependencies }` / null) into a `DirectiveOutput`.
 * Thrown errors get a `file:line:column` prefix and chain the original via
 * `Error.cause`. Shared by the top-level pass and nested resolution.
 */
async function runDirectiveHandler(inv: DirectiveInvocation): Promise<DirectiveOutput> {
  const descriptor = isDirectiveDescriptor(inv.handler) ? inv.handler : { handler: inv.handler };
  let result: DirectiveResult;
  try {
    result = await Promise.resolve(
      descriptor.handler({
        name: inv.name,
        attributes: inv.attributes,
        type: inv.type,
        innerHtml: inv.innerHtml,
        innerMarkdown: inv.innerMarkdown,
        pageFile: inv.pageFile,
        root: inv.root,
        frontmatter: inv.frontmatter,
      }),
    );
  } catch (err) {
    const where = `${inv.pageFile}${inv.line ? `:${inv.line}:${inv.column ?? 0}` : ''}`;
    throw new Error(
      `Markbook: directive '${inv.name}' in ${where} threw: ${(err as Error).message}`,
      { cause: err as Error },
    );
  }
  if (result == null) {
    return { html: '', markdownReplacement: '', dependencies: [] };
  }
  if (typeof result === 'string') {
    return { html: result, markdownReplacement: undefined, dependencies: [] };
  }
  return {
    html: result.html,
    markdownReplacement: typeof result.markdown === 'string' ? result.markdown : undefined,
    dependencies: Array.isArray(result.dependencies)
      ? result.dependencies.filter((d): d is string => typeof d === 'string')
      : [],
  };
}

/**
 * Build a container directive's inner markdown: the raw source between its
 * opening `:::name{...}` and closing `:::` lines, with each nested directive's
 * source span replaced by its markdown fallback (`subs`). With no subs this is
 * just the verbatim inner source (what `mermaid`-style handlers want). `content`
 * is the frontmatter-stripped body the mdast was parsed from, so `start` / `end`
 * (node position offsets) and `subs` offsets line up.
 */
function buildInnerMarkdown(
  content: string,
  start: number,
  end: number,
  subs: MarkdownSub[],
): string {
  const raw = content.slice(start, end);
  let substituted = raw;
  if (subs.length > 0) {
    // Splice each nested directive's markdown over its source span (offsets
    // are absolute → rebase to the container start). Nested directives never
    // touch the fence lines, so line-stripping below stays correct.
    const sorted = [...subs].sort((a, b) => a.start - b.start);
    let out = '';
    let cursor = 0;
    for (const sub of sorted) {
      const relStart = sub.start - start;
      const relEnd = sub.end - start;
      if (relStart < cursor || relStart < 0 || relEnd > raw.length) continue;
      out += raw.slice(cursor, relStart);
      out += sub.markdown;
      cursor = relEnd;
    }
    out += raw.slice(cursor);
    substituted = out;
  }
  // Strip the leading `:::name{...}` line + trailing `:::` line. Be lenient
  // about line endings.
  const lines = substituted.split('\n');
  if (lines.length <= 2) return '';
  return lines.slice(1, -1).join('\n').trim();
}

function buildPlainMarkdown(
  content: string,
  slots: DirectiveSlot[],
  propsTableMarkdown: string | undefined,
): string {
  const sorted = [...slots].sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const slot of sorted) {
    out += content.slice(cursor, slot.start);
    if (slot.kind === 'story' && slot.story?.codeFiles?.length) {
      out += slot.story.codeFiles
        .map((f) => `**\`${f.label}\`**\n\n\`\`\`${f.lang}\n${f.code}\n\`\`\``)
        .join('\n\n');
    } else if (slot.kind === 'stories') {
      const sections: string[] = [];
      for (const story of slot.stories) {
        sections.push(`### ${humanizeExportName(story.exportName)}`);
        if (story.codeFiles?.length) {
          sections.push(
            story.codeFiles
              .map((f) => `**\`${f.label}\`**\n\n\`\`\`${f.lang}\n${f.code}\n\`\`\``)
              .join('\n\n'),
          );
        }
      }
      out += sections.join('\n\n');
    } else if (slot.kind === 'props' && propsTableMarkdown) {
      out += propsTableMarkdown;
    } else if (slot.kind === 'user') {
      // User directives can provide a markdown replacement; otherwise
      // leave the original directive source unchanged (so the per-page
      // .txt mirror still reads naturally).
      if (slot.markdownReplacement !== undefined) {
        out += slot.markdownReplacement;
      } else {
        out += content.slice(slot.start, slot.end);
      }
    }
    cursor = slot.end;
  }
  out += content.slice(cursor);
  return out.replace(/\n{3,}/g, '\n\n');
}

function parseNameList(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Produce the mdast nodes that replace one directive slot. For `:::story` and
 * `:::props` this is a single raw-html node; for `:::stories` it is a sequence
 * of (heading + story-block) pairs followed by a single shared code-disclosure
 * block. Headings are real `heading` nodes so `rehype-slug` slugs them and the
 * page TOC picks them up.
 */
function buildSlotReplacement(
  slot: DirectiveSlot,
  propsTableHtml: string | undefined,
  extrasMap: Map<string, string>,
): unknown[] {
  if (slot.kind === 'story') {
    const files = slot.story.codeFiles ?? [];
    const codeBlock = files.length === 0 ? '' : renderCodeDisclosure(slot.story.id, files);
    const extras = extrasMap.get(slot.story.id) ?? '';
    return [
      {
        type: 'html',
        value: `<div class="markbook-story-block"><div class="markbook-story" data-markbook-story="${slot.story.id}"></div><div class="markbook-controls" data-markbook-controls="${slot.story.id}"></div>${extras}${codeBlock}</div>`,
      },
    ];
  }
  if (slot.kind === 'props') {
    return [
      {
        type: 'html',
        value:
          propsTableHtml ?? '<!-- markbook props table: no `component:` set in frontmatter -->',
      },
    ];
  }
  if (slot.kind === 'user') {
    // User-handler output is injected as raw HTML. If the handler returned
    // an empty string (or null/undefined), we still emit an empty html
    // node so the original directive source is removed cleanly.
    return [{ type: 'html', value: slot.html }];
  }
  // `:::stories` — fan out
  const nodes: unknown[] = [];
  for (const story of slot.stories) {
    const text = humanizeExportName(story.exportName);
    const files = story.codeFiles ?? [];
    const codeBlock = files.length === 0 ? '' : renderCodeDisclosure(story.id, files);
    const extras = extrasMap.get(story.id) ?? '';
    nodes.push({
      type: 'heading',
      depth: 3,
      children: [{ type: 'text', value: text }],
    });
    nodes.push({
      type: 'html',
      value: `<div class="markbook-story-block" data-markbook-group="${slot.groupId}"><div class="markbook-story" data-markbook-story="${story.id}"></div><div class="markbook-controls" data-markbook-controls="${story.id}"></div>${extras}${codeBlock}</div>`,
    });
  }
  return nodes;
}

// Use the export-name kebab helper for consistent slug derivation in
// downstream consumers (embed.ts).
export { kebabExportName, humanizeExportName } from './exports.js';

function renderCodeDisclosure(storyId: string, files: StoryCodeFile[]): string {
  const copyBtn = copyButton();
  if (files.length === 1) {
    const f = files[0]!;
    return `<details class="markbook-code" data-pagefind-ignore><summary>Show code</summary><div class="markbook-code-file"><div class="markbook-code-file-label">${escapeHtml(f.label)}</div><div class="markbook-code-pre-wrap">${copyBtn}${f.codeHtml}</div></div></details>`;
  }
  const tabs = files
    .map(
      (f, i) =>
        `<button type="button" role="tab" id="tab-${storyId}-${i}" aria-controls="panel-${storyId}-${i}" aria-selected="${i === 0 ? 'true' : 'false'}" tabindex="${i === 0 ? '0' : '-1'}">${escapeHtml(f.label)}</button>`,
    )
    .join('');
  const panels = files
    .map(
      (f, i) =>
        `<div role="tabpanel" id="panel-${storyId}-${i}" aria-labelledby="tab-${storyId}-${i}"${i === 0 ? '' : ' hidden'}><div class="markbook-code-pre-wrap">${copyBtn}${f.codeHtml}</div></div>`,
    )
    .join('');
  return `<details class="markbook-code" data-pagefind-ignore><summary>Show code</summary><div class="markbook-code-tabs" data-markbook-tabs="${storyId}"><div class="markbook-code-tablist" role="tablist" aria-label="Story files">${tabs}</div>${panels}</div></details>`;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function textOf(node: { type?: string; value?: string; children?: unknown[] }): string {
  if (node.type === 'text') return node.value ?? '';
  if (Array.isArray(node.children)) {
    return node.children.map((c) => textOf(c as never)).join('');
  }
  return '';
}
