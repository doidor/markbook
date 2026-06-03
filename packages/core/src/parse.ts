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
   * story's `codeFiles` have been resolved. Return `''` to skip.
   */
  renderStoryExtras?: (story: StoryRef) => string;
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

type DirectiveSlot = StorySlot | StoriesSlot | PropsSlot;

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

  const componentPath =
    typeof frontmatter.component === 'string'
      ? path.resolve(pageDir, frontmatter.component)
      : undefined;
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

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(() => async (tree: unknown) => {
      visit(tree as never, (node: any, index, parent: any) => {
        if (!parent || typeof index !== 'number') return;
        if (node.type !== 'containerDirective') return;

        const start = node.position?.start?.offset ?? 0;
        const end = node.position?.end?.offset ?? 0;

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
          pendingStoriesTasks.push({
            slot,
            src,
            absStoryFile: path.resolve(pageDir, src),
            userSlug,
            only,
            exclude,
          });
        } else if (node.name === 'props') {
          slots.push({ kind: 'props', parent, index, start, end });
        }
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
          const absStoryFile = path.resolve(pageDir, story.src);
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

      // Splice in descending source order so earlier slots' indexes are not
      // shifted by later replacements in the same parent.
      const orderedSlots = [...slots].sort((a, b) => b.start - a.start);
      for (const slot of orderedSlots) {
        const replacement = buildSlotReplacement(slot, propsTableHtml, options.renderStoryExtras);
        slot.parent.children.splice(slot.index, 1, ...(replacement as never[]));
      }
    })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
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

  return {
    frontmatter,
    html,
    plainText,
    plainMarkdown,
    stories,
    headings,
    title,
  };
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
  renderStoryExtras: ((story: StoryRef) => string) | undefined,
): unknown[] {
  if (slot.kind === 'story') {
    const files = slot.story.codeFiles ?? [];
    const codeBlock = files.length === 0 ? '' : renderCodeDisclosure(slot.story.id, files);
    const extras = renderStoryExtras ? renderStoryExtras(slot.story) : '';
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
  // `:::stories` — fan out
  const nodes: unknown[] = [];
  for (const story of slot.stories) {
    const text = humanizeExportName(story.exportName);
    const files = story.codeFiles ?? [];
    const codeBlock = files.length === 0 ? '' : renderCodeDisclosure(story.id, files);
    const extras = renderStoryExtras ? renderStoryExtras(story) : '';
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCodeDisclosure(storyId: string, files: StoryCodeFile[]): string {
  if (files.length === 1) {
    const f = files[0]!;
    return `<details class="markbook-code" data-pagefind-ignore><summary>Show code</summary><div class="markbook-code-file"><div class="markbook-code-file-label">${escapeHtml(f.label)}</div>${f.codeHtml}</div></details>`;
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
        `<div role="tabpanel" id="panel-${storyId}-${i}" aria-labelledby="tab-${storyId}-${i}"${i === 0 ? '' : ' hidden'}>${f.codeHtml}</div>`,
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
