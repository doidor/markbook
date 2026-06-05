import { codeToHtml } from 'shiki';

/**
 * Shared code-block rendering primitives, used by three places that all
 * need to look identical: story-source disclosures (`parse.ts`), fenced
 * markdown code blocks (`fenced-code.ts`), and the per-file source view
 * (`code.ts`). Centralizing the Shiki config + copy button means a single
 * theme/markup change re-skins every code block at once.
 */

/**
 * Shiki dual-theme config: `github-light` + `github-dark` with
 * `defaultColor: false`, so a `[data-theme]` swap re-paints the syntax
 * colors with no rebuild.
 */
export const SHIKI_DUAL_THEME = { light: 'github-light', dark: 'github-dark' } as const;

/** Highlight `code` to Shiki dual-theme HTML for the given language id. */
export function highlightCode(code: string, lang: string): Promise<string> {
  return codeToHtml(code, { lang, themes: SHIKI_DUAL_THEME, defaultColor: false });
}

/**
 * The hover-revealed "Copy" button that lives inside a
 * `.markbook-code-pre-wrap`. The boot script (`COPY_BOOT_SCRIPT`) finds the
 * closest wrap and copies its `<pre>` text.
 *
 * Pass `pagefindIgnore: true` when the button is NOT already inside a
 * `data-pagefind-ignore` container (fenced code blocks) so the literal
 * "Copy" glyph stays out of the search index and result excerpts. Story
 * disclosures sit inside a `data-pagefind-ignore` `<details>`, so they
 * leave it off.
 */
export function copyButton(pagefindIgnore = false): string {
  const pf = pagefindIgnore ? ' data-pagefind-ignore="all"' : '';
  return `<button type="button" class="markbook-code-copy" data-markbook-copy${pf} aria-label="Copy code"><span class="markbook-copy-label">Copy</span></button>`;
}
