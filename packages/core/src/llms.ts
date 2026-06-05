import path from 'node:path';
import fs from 'node:fs/promises';
import { capitalize, isIndexHref } from './nav.js';
import type { PageRecord } from './build.js';

/**
 * UTF-8 byte-order mark — `EF BB BF` when serialised. Prepended to every
 * emitted `.txt` (per-page mirrors AND the top-level index) so browsers
 * decode the file as UTF-8 regardless of the host's `Content-Type` header.
 * Modern markdown parsers and LLM ingestion pipelines strip BOMs
 * transparently; the cost is 3 bytes per file.
 */
const UTF8_BOM = '\uFEFF';

/**
 * Emit the top-level `llms.txt` index plus every page's per-page mirror
 * under `<outDir>/llms/`. Called by `build()` against the production
 * `outDir`, and by `dev()` against `tmpDir` so the layout's
 * `<a href="/llms.txt">` link AND the per-page "View / Copy as Markdown"
 * buttons both work in dev — not just in `markbook build`.
 *
 * Exported for tests / advanced consumers.
 */
export async function emitLlms(
  pages: PageRecord[],
  outDir: string,
  siteTitle: string | null,
  siteDescription: string | undefined,
): Promise<void> {
  await emitPerPageLlmsTxt(pages, outDir);

  // Fall back to the index page's title (or the first page's) so the
  // llms.txt index still has a meaningful H1 when no `config.title` was
  // supplied.
  const indexPage = pages.find((p) => isIndexHref(p.htmlRelPath));
  const titleH1 = siteTitle ?? indexPage?.parsed.title ?? pages[0]?.parsed.title ?? 'Documentation';

  const lines: string[] = [];
  lines.push(`# ${titleH1}`);
  lines.push('');
  lines.push(
    '> **Note:** This is a summary overview using the LLMs.txt format (https://llmstxt.org/). Each section links to its full documentation file in plain text format.',
  );
  lines.push('');
  if (siteDescription) {
    lines.push(siteDescription);
    lines.push('');
  }

  for (const page of pages) {
    const linkText = formatLinkText(page);
    const url = `./llms/${page.txtRelPath.replace(/\\/g, '/')}`;
    const desc =
      typeof page.parsed.frontmatter.description === 'string'
        ? `: ${page.parsed.frontmatter.description}`
        : '';
    lines.push(`- [${linkText}](${url})${desc}`);
  }

  await fs.writeFile(path.join(outDir, 'llms.txt'), `${UTF8_BOM}${lines.join('\n')}\n`);
}

/**
 * Write every page's plain-markdown mirror to `<base>/llms/<page>.txt`.
 * Used both by `emitLlms` (for the static dist output) and `writePages`
 * (for the dev/build tmpDir so the "View as Markdown" buttons resolve).
 *
 * Each file starts with a UTF-8 BOM so browsers (and naive readers that
 * don't honour HTTP `charset=utf-8`) detect the encoding from the bytes
 * themselves. Without it, hosts that serve `.txt` as `text/plain` with
 * no charset (Vite's default, Python's `http.server`, some CDNs) cause
 * browsers to fall back to Latin-1 — emojis and em-dashes display as
 * mojibake.
 */
export async function emitPerPageLlmsTxt(pages: PageRecord[], baseDir: string): Promise<void> {
  const llmsDir = path.join(baseDir, 'llms');
  for (const page of pages) {
    const txtAbs = path.join(llmsDir, page.txtRelPath);
    await fs.mkdir(path.dirname(txtAbs), { recursive: true });
    const startsWithH1 = /^#\s/.test(page.parsed.plainMarkdown);
    const txtContent = startsWithH1
      ? page.parsed.plainMarkdown
      : `# ${page.parsed.title}\n\n${page.parsed.plainMarkdown}`;
    await fs.writeFile(txtAbs, `${UTF8_BOM}${txtContent}\n`);
  }
}

function formatLinkText(page: PageRecord): string {
  const segments = page.relPath.replace(/\.md$/, '').split(/[\\/]/);
  const last = segments[segments.length - 1];
  if (segments.length === 1 && last && last.toLowerCase() === 'index') {
    return page.parsed.title;
  }
  const dirSegments = segments.slice(0, -1).map(capitalize);
  const dir = dirSegments.join('/');
  return dir ? `${dir}/${page.parsed.title}` : page.parsed.title;
}
