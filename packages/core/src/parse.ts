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

export interface StoryRef {
  id: string;
  src: string;
  exportName: string;
  /** User-provided embed slug from the directive's `id=` attribute. Stable across file moves. */
  slug?: string;
  code?: string;
  codeHtml?: string;
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
  }) => Promise<{ code: string; codeHtml: string } | null>;
  resolveProps?: (info: {
    absComponentFile: string;
    exportName?: string;
  }) => Promise<{ tableHtml: string; tableMarkdown: string } | null>;
  /** Returns the raw text of a template file given its `<name>` (no extension). */
  loadTemplate?: (name: string) => Promise<string>;
}

interface DirectiveSlot {
  kind: 'story' | 'props';
  parent: { children: unknown[] };
  index: number;
  start: number;
  end: number;
  story?: StoryRef;
}

export async function parseMarkdown(
  source: string,
  fileId: string,
  options: ParseOptions,
): Promise<ParsedPage> {
  const { pageFile, resolveStoryCode, resolveProps } = options;
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
  let propsTableMarkdown: string | undefined;

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
        } else if (node.name === 'props') {
          slots.push({ kind: 'props', parent, index, start, end });
        }
      });

      const tasks: Array<Promise<void>> = [];

      if (resolveStoryCode) {
        for (const story of stories) {
          tasks.push(
            (async () => {
              const absStoryFile = path.resolve(pageDir, story.src);
              const result = await resolveStoryCode({
                absStoryFile,
                exportName: story.exportName,
              });
              if (result) {
                story.code = result.code;
                story.codeHtml = result.codeHtml;
              }
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

      for (const slot of slots) {
        if (slot.kind === 'story' && slot.story) {
          const codeBlock = slot.story.codeHtml
            ? `<details class="markbook-code" data-pagefind-ignore><summary>Show code</summary>${slot.story.codeHtml}</details>`
            : '';
          slot.parent.children[slot.index] = {
            type: 'html',
            value: `<div class="markbook-story-block"><div class="markbook-story" data-markbook-story="${slot.story.id}"></div>${codeBlock}</div>`,
          } as never;
        } else if (slot.kind === 'props') {
          slot.parent.children[slot.index] = {
            type: 'html',
            value:
              propsTableHtml ?? '<!-- markbook props table: no `component:` set in frontmatter -->',
          } as never;
        }
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
    if (slot.kind === 'story' && slot.story?.code) {
      out += `\`\`\`tsx\n${slot.story.code}\n\`\`\``;
    } else if (slot.kind === 'props' && propsTableMarkdown) {
      out += propsTableMarkdown;
    }
    cursor = slot.end;
  }
  out += content.slice(cursor);
  return out.replace(/\n{3,}/g, '\n\n');
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
