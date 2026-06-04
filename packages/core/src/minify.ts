import { transformWithEsbuild } from 'vite';

/**
 * CSS + JS minification helpers for Markbook's inlined assets.
 *
 * Markbook injects three flavours of inline content into every page:
 *
 *   1. `BASE_CSS` — the built-in chrome stylesheet (~10KB unminified).
 *      Static across builds; minified once at first use and cached.
 *   2. Boot scripts (theme, tabs, playground, copy, permalink, copy-md,
 *      search-kbd) — small IIFEs (~200B-1KB each). Static; minified once.
 *   3. User CSS — content of every file in `config.css`. Varies per
 *      project; minified once per build at context-creation time.
 *
 * Without minification, Lighthouse flags every page with "Minify CSS"
 * and "Minify JavaScript" warnings. Inline assets bypass Vite's normal
 * bundler-side minification (they're embedded in the HTML by our code
 * after Vite finishes), so we have to handle it ourselves.
 *
 * Uses Vite's re-exported `transformWithEsbuild` — no extra dependency.
 */

const cssCache = new Map<string, string>();
const jsCache = new Map<string, string>();

/**
 * Minify a CSS string. Strips comments, collapses whitespace, shortens
 * color values, and applies the rest of esbuild's CSS minifier. Pure
 * function — caches by source string so repeated calls are free.
 */
export async function minifyCss(source: string): Promise<string> {
  if (!source) return source;
  const cached = cssCache.get(source);
  if (cached !== undefined) return cached;
  try {
    const result = await transformWithEsbuild(source, 'inline.css', {
      loader: 'css',
      minify: true,
      // Don't try to bundle (we're transforming a self-contained block).
      sourcemap: false,
    });
    const minified = result.code.trim();
    cssCache.set(source, minified);
    return minified;
  } catch {
    // If esbuild rejects the input (rare — would indicate malformed CSS),
    // fall back to the original. Better to ship unminified than to break
    // the build over a stylesheet bug.
    cssCache.set(source, source);
    return source;
  }
}

/**
 * Minify a JS string (suitable for inline `<script>` content). Strips
 * comments and whitespace; safe-renames in IIFE scopes. Pure function;
 * caches by source.
 */
export async function minifyJs(source: string): Promise<string> {
  if (!source) return source;
  const cached = jsCache.get(source);
  if (cached !== undefined) return cached;
  try {
    const result = await transformWithEsbuild(source, 'inline.js', {
      loader: 'js',
      minify: true,
      sourcemap: false,
      // Boot scripts are classic scripts; esbuild's default target is fine.
    });
    const minified = result.code.trim();
    jsCache.set(source, minified);
    return minified;
  } catch {
    jsCache.set(source, source);
    return source;
  }
}
