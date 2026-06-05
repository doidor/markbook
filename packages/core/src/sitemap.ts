import path from 'node:path';
import fs from 'node:fs/promises';
import type { PageRecord } from './build.js';

/**
 * Normalize a user-supplied `siteUrl` for canonical/OG/sitemap use:
 *   - Returns `null` if unset.
 *   - Strips any trailing slash so concatenation with page paths is clean.
 *   - Throws on an obviously-malformed input (must parse as an `http(s)`
 *     URL with no path, query, or fragment).
 */
export function normalizeSiteUrl(raw: string | undefined | null): string | null {
  if (raw == null || raw === '') return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `Markbook: invalid siteUrl '${raw}' — expected an absolute http(s) URL like 'https://example.com'.`,
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Markbook: siteUrl '${raw}' must use http or https; got '${parsed.protocol}'.`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`Markbook: siteUrl '${raw}' must not contain a query string or fragment.`);
  }
  // Normalize: keep origin + any base path, strip trailing slash.
  let normalized = `${parsed.origin}${parsed.pathname}`;
  if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
}

/**
 * Emit `dist/sitemap.xml` listing every built page, plus a `dist/robots.txt`
 * that references the sitemap. Skipped when `siteUrl` is not configured —
 * the sitemap spec requires absolute URLs.
 *
 * Exported for tests / advanced consumers. `build()` calls this
 * automatically after Vite finishes.
 */
export async function emitSitemapAndRobots(
  pages: PageRecord[],
  outDir: string,
  siteUrl: string | null,
): Promise<void> {
  if (!siteUrl) return;
  const today = new Date().toISOString().slice(0, 10);
  const urls = pages
    .map((p) => {
      const url = `${siteUrl}/${p.htmlRelPath.replace(/\\/g, '/')}`;
      // index.html → canonical URL ends at the directory (cleaner sitemap entry).
      const canonical = url.endsWith('/index.html') ? url.slice(0, -'index.html'.length) : url;
      return `  <url>\n    <loc>${escapeXml(canonical)}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`;
    })
    .join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  await fs.writeFile(path.join(outDir, 'sitemap.xml'), sitemap);

  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
  await fs.writeFile(path.join(outDir, 'robots.txt'), robots);
}

/** XML-escape (uses `&apos;`, valid in XML) for `<loc>` values in the sitemap. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
