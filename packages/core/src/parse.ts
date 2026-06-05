import path from 'node:path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSlug from 'rehype-slug';
import { visit } from 'unist-util-visit';
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
    handler: import('./config.js').DirectiveHandler;
    formInSource: 'leaf' | 'container';
    attributes: Record<string, string | undefined>;
    childrenSnapshot: unknown[];
    /** Raw markdown source between the opening `:::` and closing `:::`. */
    innerMarkdownSource: string | null;
    line?: number;
    column?: number;
  }
  const pendingUserDirectiveTasks: PendingUserDirectiveTask[] = [];

  const userDirectives = options.userDirectives ?? {};

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
          return;
        }

        // User directives — registered via config.directives.
        const handler = userDirectives[node.name as string];
        if (!handler) return;

        const attrs = (node.attributes ?? {}) as Record<string, string | undefined>;
        // Validate pinned `type` against actual source form (clearer error
        // than silently letting the handler see an unexpected innerHtml).
        const descriptor = isDirectiveDescriptor(handler) ? handler : { handler };
        const pinned = descriptor.type;
        const actualForm: 'leaf' | 'container' = isContainer ? 'container' : 'leaf';
        if (pinned && pinned !== actualForm) {
          const pos = node.position?.start;
          throw new Error(
            `Markbook: directive '${node.name}' in ${pageFile}` +
              (pos ? `:${pos.line}:${pos.column}` : '') +
              ` was written as ${actualForm} (${actualForm === 'leaf' ? '::' : ':::'}${node.name}…) but the handler is pinned to ${pinned}.`,
          );
        }

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
          innerMarkdownSource: isContainer ? source.slice(start, end) : null,
          line: node.position?.start?.line,
          column: node.position?.start?.column,
        });
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
            const innerHtml =
              task.formInSource === 'container'
                ? await renderChildrenToHtml(task.childrenSnapshot)
                : null;
            const innerMarkdown =
              task.formInSource === 'container' ? extractInnerMarkdown(source, task.slot) : null;
            const descriptor = isDirectiveDescriptor(task.handler)
              ? task.handler
              : { handler: task.handler };
            let result: import('./config.js').DirectiveResult;
            try {
              result = await Promise.resolve(
                descriptor.handler({
                  name: task.name,
                  attributes: task.attributes,
                  type: task.formInSource,
                  innerHtml,
                  innerMarkdown,
                  pageFile,
                  root: options.root ?? path.dirname(pageFile),
                  frontmatter,
                }),
              );
            } catch (err) {
              const where = `${pageFile}${task.line ? `:${task.line}:${task.column ?? 0}` : ''}`;
              throw new Error(
                `Markbook: directive '${task.name}' in ${where} threw: ${(err as Error).message}`,
                { cause: err as Error },
              );
            }
            if (result == null) {
              task.slot.html = '';
              task.slot.markdownReplacement = '';
            } else if (typeof result === 'string') {
              task.slot.html = result;
            } else {
              task.slot.html = result.html;
              if (typeof result.markdown === 'string') {
                task.slot.markdownReplacement = result.markdown;
              }
              if (Array.isArray(result.dependencies)) {
                task.slot.dependencies = result.dependencies.filter(
                  (d): d is string => typeof d === 'string',
                );
              }
            }
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
  const directiveDependencies = [
    ...new Set(slots.flatMap((s) => (s.kind === 'user' ? s.dependencies : []))),
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

/** Type-guard distinguishing the `{ type, handler }` descriptor form from the function shorthand. */
function isDirectiveDescriptor(
  h: import('./config.js').DirectiveHandler,
): h is import('./config.js').DirectiveHandlerDescriptor {
  return typeof h !== 'function' && typeof (h as { handler?: unknown }).handler === 'function';
}

/**
 * Render a snapshot of mdast container-directive children into HTML using
 * the same plugin stack the top-level pipeline uses. Built-in directives
 * inside the children DON'T run (we'd hit recursion semantics that aren't
 * defined yet); plain markdown and any nested user directives in the
 * original tree DO render because they're already part of the snapshot's
 * AST. For v1, scope is "render rich markdown inside callouts," not
 * "nest custom directives inside callouts."
 */
async function renderChildrenToHtml(children: unknown[]): Promise<string> {
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
 * Return the raw markdown source between the opening `:::` and closing
 * `:::` of a container directive — without the directive's own header
 * line. Used so user handlers can ALSO see the original markdown text
 * (some need it: e.g. `mermaid` wants the source verbatim, not parsed).
 */
function extractInnerMarkdown(source: string, slot: BaseSlot): string {
  const raw = source.slice(slot.start, slot.end);
  // Strip the leading `:::name{...}` line + trailing `:::` line. Be lenient
  // about line endings.
  const lines = raw.split('\n');
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
