import { minifyCss, minifyJs } from './minify.js';

/**
 * Static inline assets injected into every generated page: the built-in
 * chrome stylesheet (`BASE_CSS`) and the eight boot-script IIFEs (theme,
 * tabs, playground, copy, permalink, search-kbd, copy-md, nav-toggle).
 *
 * They never change between builds, so `ensureInlineAssetsMinified()`
 * minifies them once (lazily, process-wide) and the module-private bindings
 * are mutated in place. `getInlineAssets()` returns the current snapshot —
 * after `ensureInlineAssetsMinified()` has resolved, that snapshot is the
 * minified form. `createContext` awaits the minify so every entry point
 * (`build`, `dev`, `preview`) inherits it without awaiting later.
 */

/**
 * Inline IIFE: read the saved theme from localStorage (or the OS preference on
 * first visit), apply it to <html data-theme=…> before paint, and delegate
 * clicks on the theme toggle button to flip it.
 */
let THEME_BOOT_SCRIPT = `(function(){var s;try{s=localStorage.getItem('markbook-theme')}catch(e){}var t=s==='dark'||s==='light'?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-markbook-theme-toggle]');if(!b)return;var c=document.documentElement.dataset.theme;var n=c==='dark'?'light':'dark';document.documentElement.dataset.theme=n;try{localStorage.setItem('markbook-theme',n)}catch(e){}});})();`;

let TABS_BOOT_SCRIPT = `(function(){function activate(tab){var wrap=tab.closest('[data-markbook-tabs]');if(!wrap)return;var tabs=wrap.querySelectorAll('[role="tab"]');var pid=tab.getAttribute('aria-controls');for(var i=0;i<tabs.length;i++){var t=tabs[i];t.setAttribute('aria-selected',t===tab?'true':'false');t.tabIndex=t===tab?0:-1;}var panels=wrap.querySelectorAll('[role="tabpanel"]');for(var j=0;j<panels.length;j++){panels[j].hidden=panels[j].id!==pid;}}document.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('[role="tab"]');if(t&&t.closest('[data-markbook-tabs]'))activate(t);});document.addEventListener('keydown',function(e){var t=e.target&&e.target.closest&&e.target.closest('[role="tab"]');if(!t||!t.closest('[data-markbook-tabs]'))return;if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();var tabs=t.parentElement.querySelectorAll('[role="tab"]');var i=Array.prototype.indexOf.call(tabs,t);var n=e.key==='ArrowRight'?(i+1)%tabs.length:(i-1+tabs.length)%tabs.length;tabs[n].focus();activate(tabs[n]);});})();`;

/**
 * Delegated click handler for [data-markbook-playground] buttons. Each button
 * carries a base64-encoded JSON descriptor with provider-specific form
 * fields (action URL + named values). On click we decode, build a hidden
 * form, append to body, submit, then remove. Posts in a new tab so the
 * docs page is not navigated away from.
 */
let PLAYGROUND_BOOT_SCRIPT = `(function(){document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-markbook-playground]');if(!b)return;e.preventDefault();var d;try{d=JSON.parse(atob(b.getAttribute('data-payload')||''));}catch(err){console.error('markbook: malformed playground payload',err);return;}var f=document.createElement('form');f.action=d.action;f.method='POST';f.target='_blank';f.style.display='none';for(var i=0;i<d.fields.length;i++){var pair=d.fields[i];var input=document.createElement('input');input.type='hidden';input.name=pair[0];input.value=pair[1];f.appendChild(input);}document.body.appendChild(f);f.submit();f.parentNode.removeChild(f);});})();`;

/**
 * Copy-code button. Delegated click handler reads the nearest `<pre>` block,
 * extracts its textContent, copies via navigator.clipboard, briefly flips
 * the button label to "Copied!" for ~1.2s.
 */
let COPY_BOOT_SCRIPT = `(function(){document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-markbook-copy]');if(!b)return;e.preventDefault();var wrap=b.closest('.markbook-code-pre-wrap');var pre=wrap&&wrap.querySelector('pre');if(!pre||!navigator.clipboard)return;navigator.clipboard.writeText(pre.textContent||'').then(function(){var lbl=b.querySelector('.markbook-copy-label');if(!lbl)return;var prev=lbl.textContent;lbl.textContent='Copied!';b.classList.add('is-copied');setTimeout(function(){lbl.textContent=prev;b.classList.remove('is-copied');},1200);}).catch(function(err){console.error('markbook: clipboard write failed',err);});});})();`;

/**
 * Heading permalinks. Click on a [data-markbook-permalink] anchor copies the
 * canonical page URL + fragment to the clipboard (still navigates, so the
 * URL bar updates as expected). Modifier-clicks (cmd/ctrl/shift) skip the
 * clipboard write so users can open in a new tab via standard browser UX.
 */
let PERMALINK_BOOT_SCRIPT = `(function(){document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('[data-markbook-permalink]');if(!a)return;if(e.metaKey||e.ctrlKey||e.shiftKey)return;if(!navigator.clipboard)return;var h=a.getAttribute('href')||'';var url=location.origin+location.pathname+h;navigator.clipboard.writeText(url).catch(function(){});});})();`;

/**
 * Cmd-K / Ctrl-K opens the Pagefind search input. Slash key also works
 * (Algolia DocSearch / GitHub convention). Only active when search is
 * enabled — handler is omitted from the HTML in dev mode.
 */
let SEARCH_KBD_BOOT_SCRIPT = `(function(){function focus(){var input=document.querySelector('.pagefind-ui input, #markbook-search-ui input');if(input){input.focus();input.select&&input.select();return true;}return false;}document.addEventListener('keydown',function(e){var t=e.target;var inField=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable);if((e.key==='k'||e.key==='K')&&(e.metaKey||e.ctrlKey)){e.preventDefault();focus();return;}if(e.key==='/'&&!inField){e.preventDefault();focus();}});})();`;

/**
 * "Copy as Markdown" button handler. Delegated click reads the button's
 * data-url, fetches the per-page llms.txt mirror, writes the content to
 * the clipboard, and flips the label to "Copied!" for ~1.2s. Detects
 * file:// (where fetch can't reach the .txt file) and shows a tooltip
 * instead of silently failing.
 */
let COPY_MD_BOOT_SCRIPT = `(function(){if(location.protocol==='file:'){var btns=document.querySelectorAll('[data-markbook-copy-md]');for(var i=0;i<btns.length;i++){var b=btns[i];b.disabled=true;b.title='Serve this site over http(s) to copy markdown.';b.style.opacity='0.5';b.style.cursor='not-allowed';}return;}document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-markbook-copy-md]');if(!b)return;e.preventDefault();if(!navigator.clipboard){return;}var url=b.getAttribute('data-url')||'';var lbl=b.querySelector('.markbook-copy-md-label');var prev=lbl?lbl.textContent:'';fetch(url).then(function(r){if(!r.ok)throw new Error('http '+r.status);return r.text();}).then(function(text){return navigator.clipboard.writeText(text);}).then(function(){if(!lbl)return;lbl.textContent='Copied!';b.classList.add('is-copied');setTimeout(function(){lbl.textContent=prev;b.classList.remove('is-copied');},1200);}).catch(function(err){console.error('markbook: copy-as-markdown failed',err);if(!lbl)return;lbl.textContent='Copy failed';setTimeout(function(){lbl.textContent=prev;},1500);});});})();`;

/**
 * Mobile nav toggle. The hamburger button + slide-out sidebar on small
 * viewports — the sidebar is permanently in DOM (display-grid on desktop),
 * and on mobile CSS positions it off-canvas via translateX(-100%) by
 * default. This handler flips the `data-markbook-nav-open` attribute on
 * `<body>` (CSS scope for the open state) and `aria-expanded` on every
 * toggle button. Closes on:
 *   - second click of the toggle
 *   - click on the backdrop overlay ([data-markbook-nav-backdrop])
 *   - click on any link inside .markbook-sidebar (so the user lands on
 *     the new page with the menu already closed)
 *   - Escape key (restores focus to the first toggle button)
 *
 * Desktop behaviour is unaffected — the CSS slide-out rules are scoped
 * under `@media (max-width: 700px)`, so on wider viewports the body
 * attribute does nothing visible and the sidebar stays inline in the
 * grid layout.
 */
let NAV_TOGGLE_BOOT_SCRIPT = `(function(){function setOpen(o){var b=document.body;var btns=document.querySelectorAll('[data-markbook-nav-toggle]');if(o){b.dataset.markbookNavOpen='true';}else{delete b.dataset.markbookNavOpen;}for(var i=0;i<btns.length;i++){btns[i].setAttribute('aria-expanded',o?'true':'false');}}document.addEventListener('click',function(e){var t=e.target;if(!t||!t.closest)return;var btn=t.closest('[data-markbook-nav-toggle]');if(btn){e.preventDefault();setOpen(document.body.dataset.markbookNavOpen!=='true');return;}var bd=t.closest('[data-markbook-nav-backdrop]');if(bd){setOpen(false);return;}var link=t.closest('.markbook-sidebar a');if(link){setOpen(false);}});document.addEventListener('keydown',function(e){if(e.key!=='Escape')return;if(document.body.dataset.markbookNavOpen!=='true')return;setOpen(false);var btn=document.querySelector('[data-markbook-nav-toggle]');if(btn&&btn.focus)btn.focus();});})();`;

/**
 * Speculation Rules — hover/pointerdown prefetch of same-origin pages so the
 * next page is already in cache by the time the user clicks, which (paired
 * with the View Transitions base CSS) is what makes a full page load feel
 * SPA-like / "cached". Injected as `<script type="speculationrules">` in
 * `{{ head }}`.
 *
 *   - `eagerness: "moderate"` → prefetch on hover (~200ms) or pointerdown,
 *     not eagerly on render, so it only fetches what the user is about to
 *     click. One small HTML doc per hovered link.
 *   - `href_matches: "/*"` restricts to same-origin links (works under a
 *     base path like `/markbook/...` — `*` spans path segments).
 *
 * Chromium-only today; Firefox/Safari ignore the block, and it is a no-op on
 * `file:` pages — pure progressive enhancement. Already-minified JSON, so it
 * skips `doMinify` (esbuild's JS loader would mis-parse a bare object).
 */
const SPECULATION_RULES = `{"prefetch":[{"where":{"href_matches":"/*"},"eagerness":"moderate"}]}`;

let BASE_CSS = `
:root {
  --mb-bg: #ffffff;
  --mb-fg: #1a1a1a;
  --mb-fg-muted: #5b5b66;
  --mb-border: #e6e6eb;
  --mb-bg-elev: #f7f7f9;
  --mb-bg-soft: #fafafa;
  --mb-accent: #6c5ce7;
  --mb-accent-fg: #ffffff;
  --mb-link: #4a3aff;
  --mb-code-bg: #f6f6fa;
  --mb-radius: 6px;
  --mb-font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --mb-font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  --mb-content-width: 720px;
  --mb-sidebar-width: 240px;
  --mb-toc-width: 200px;
  --mb-header-height: 56px;
  color-scheme: light;
}
[data-theme="dark"] {
  --mb-bg: #0e0e12;
  --mb-fg: #e6e6eb;
  --mb-fg-muted: #94949e;
  --mb-border: #2a2a32;
  --mb-bg-elev: #1a1a22;
  --mb-bg-soft: #16161c;
  --mb-accent: #8b7eff;
  --mb-accent-fg: #ffffff;
  --mb-link: #b6acff;
  --mb-code-bg: #1a1a22;
  color-scheme: dark;
}
*,*::before,*::after { box-sizing: border-box; }
/* View Transitions — make a full cross-document navigation feel SPA-like.
   'navigation: auto' opts every same-origin page load into the browser's
   View Transitions API (Chromium 126+, Safari 18.2+); unsupported browsers
   (Firefox today) just navigate normally — pure progressive enhancement, no
   client-side router. Cut cleanly between pages instead of cross-fading:
   opacity-fading two different pages superimposes their text — a muddy "double
   exposure" that reads as a flash even with view transitions on. With an instant
   cut the API simply holds the old frame until the new page has painted, then
   swaps without the blank/white repaint of a normal navigation — the chrome
   (identical between pages) appears to stay put while the content changes, a
   crisp SPA-style route change. No animation also means nothing to undo for
   prefers-reduced-motion. */
@view-transition { navigation: auto; }
::view-transition-group(root),
::view-transition-old(root),
::view-transition-new(root) { animation: none; }
/* The 'scrollbar-gutter: stable' rule reserves space for the vertical
   scrollbar even on short pages, so navigation between long and short
   pages doesn't cause the layout to jitter horizontally (the viewport
   width stays constant whether or not the scrollbar is drawn). */
html {
  scrollbar-gutter: stable;
}
html, body {
  margin: 0;
  background: var(--mb-bg);
  color: var(--mb-fg);
  font-family: var(--mb-font-sans);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--mb-link); text-decoration: none; }
a:hover { text-decoration: underline; }
.markbook-header {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 1rem;
  height: var(--mb-header-height);
  padding: 0 1.5rem;
  background: var(--mb-bg);
  border-bottom: 1px solid var(--mb-border);
}
.markbook-brand {
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--mb-fg);
  display: inline-flex; align-items: center; gap: 0.5rem;
}
.markbook-brand:hover { text-decoration: none; }
.markbook-logo { font-size: 1.2rem; }
.markbook-theme-toggle {
  background: transparent;
  border: 1px solid var(--mb-border);
  border-radius: var(--mb-radius);
  width: 32px;
  height: 32px;
  cursor: pointer;
  color: var(--mb-fg-muted);
  font-size: 0.95rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: inherit;
  flex-shrink: 0;
}
.markbook-theme-toggle:hover {
  color: var(--mb-fg);
  background: var(--mb-bg-elev);
}
.markbook-theme-toggle .markbook-icon-sun,
.markbook-theme-toggle .markbook-icon-moon { display: none; }
[data-theme="dark"] .markbook-theme-toggle .markbook-icon-sun { display: inline; }
:root:not([data-theme="dark"]) .markbook-theme-toggle .markbook-icon-moon { display: inline; }
.markbook-nav-toggle {
  display: none;
  appearance: none;
  background: transparent;
  border: 1px solid var(--mb-border);
  border-radius: var(--mb-radius);
  width: 32px;
  height: 32px;
  cursor: pointer;
  color: var(--mb-fg-muted);
  font-size: 1.1rem;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: inherit;
  flex-shrink: 0;
  margin-right: 0.25rem;
}
.markbook-nav-toggle:hover {
  color: var(--mb-fg);
  background: var(--mb-bg-elev);
}
.markbook-nav-toggle:focus-visible {
  outline: 2px solid var(--mb-accent);
  outline-offset: 2px;
}
.markbook-nav-toggle .markbook-icon-close { display: none; }
body[data-markbook-nav-open] .markbook-nav-toggle .markbook-icon-menu { display: none; }
body[data-markbook-nav-open] .markbook-nav-toggle .markbook-icon-close { display: inline; }
.markbook-nav-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9;
  cursor: pointer;
}
.markbook-content .shiki,
.markbook-content .shiki span {
  color: var(--shiki-light);
  background-color: var(--shiki-light-bg);
}
[data-theme="dark"] .markbook-content .shiki,
[data-theme="dark"] .markbook-content .shiki span {
  color: var(--shiki-dark);
  background-color: var(--shiki-dark-bg);
}
.markbook-search-ui {
  position: relative;
  width: 360px;
  max-width: 50vw;
  margin-left: auto;
  --pagefind-ui-scale: 1;
  --pagefind-ui-primary: var(--mb-accent);
  --pagefind-ui-text: var(--mb-fg);
  --pagefind-ui-background: var(--mb-bg);
  --pagefind-ui-border: var(--mb-border);
  --pagefind-ui-tag: var(--mb-bg-elev);
  --pagefind-ui-border-width: 1px;
  --pagefind-ui-border-radius: var(--mb-radius);
  --pagefind-ui-font: var(--mb-font-sans);
}
.markbook-search-ui .pagefind-ui__search-input {
  height: 36px;
  padding: 0 36px 0 32px;
  font-size: 0.875rem;
  font-weight: 400;
  background: var(--mb-bg-elev);
  color: var(--mb-fg);
  border-color: var(--mb-border);
}
.markbook-search-ui .pagefind-ui__form::before {
  width: 14px;
  height: 14px;
  top: 11px;
  left: 11px;
  opacity: 0.5;
}
.markbook-search-ui .pagefind-ui__search-clear {
  height: 30px;
  top: 3px;
  right: 3px;
  padding: 0 0.6rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--mb-fg-muted);
  background: transparent;
  border-radius: 4px;
}
.markbook-search-ui .pagefind-ui__search-clear:hover {
  color: var(--mb-fg);
  background: var(--mb-bg-elev);
}
.markbook-search-ui .pagefind-ui__drawer {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: auto;
  width: 480px;
  max-width: min(calc(100vw - 3rem), 600px);
  max-height: 70vh;
  overflow-y: auto;
  background: var(--mb-bg);
  border: 1px solid var(--mb-border);
  border-radius: var(--mb-radius);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  padding: 0.25rem 0.5rem;
  margin: 0;
  z-index: 20;
  gap: 0;
  flex-direction: column;
}
.markbook-search-ui .pagefind-ui__results-area {
  min-width: 0;
  margin-top: 0;
}
.markbook-search-ui .pagefind-ui__message {
  height: auto;
  padding: 0.5rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--mb-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}
.markbook-search-ui .pagefind-ui__results { padding: 0; }
.markbook-search-ui .pagefind-ui__result {
  padding: 0.6rem 0.5rem;
  border-top: 1px solid var(--mb-border);
  gap: 0;
}
.markbook-search-ui .pagefind-ui__result:last-of-type { border-bottom: none; }
.markbook-search-ui .pagefind-ui__result-thumb { display: none; }
.markbook-search-ui .pagefind-ui__result-inner {
  flex: 1;
  margin-top: 0;
  gap: 0;
}
.markbook-search-ui .pagefind-ui__result-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 0.2rem;
}
.markbook-search-ui .pagefind-ui__result-excerpt {
  font-size: 0.8rem;
  color: var(--mb-fg-muted);
  line-height: 1.5;
  min-width: 0;
  margin-top: 0;
}
.markbook-search-ui .pagefind-ui__result-link {
  color: var(--mb-fg);
  text-decoration: none;
}
.markbook-search-ui .pagefind-ui__result-link:hover { color: var(--mb-link); }
.markbook-search-ui .pagefind-ui__result-nested {
  padding-left: 0.875rem;
  padding-top: 0.4rem;
}
.markbook-search-ui .pagefind-ui__result-nested .pagefind-ui__result-link::before {
  font-size: 0.85em;
  opacity: 0.5;
}
.markbook-search-ui mark {
  background: color-mix(in srgb, var(--mb-accent) 22%, transparent);
  color: var(--mb-fg);
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 500;
}
.markbook-search-ui .pagefind-ui__button {
  height: 32px;
  padding: 0 1rem;
  font-size: 0.85rem;
  margin: 0.5rem 0;
  font-weight: 500;
  background: var(--mb-bg-elev);
  border-color: var(--mb-border);
  color: var(--mb-fg);
}
.markbook-search-ui .pagefind-ui__button:hover {
  background: var(--mb-border);
  border-color: var(--mb-border);
  color: var(--mb-fg);
}
.markbook-shell {
  display: grid;
  grid-template-columns: var(--mb-sidebar-width) 1fr var(--mb-toc-width);
  gap: 1.5rem;
  max-width: 1320px;
  margin: 0 auto;
  padding: 1.5rem;
}
.markbook-shell.no-toc { grid-template-columns: var(--mb-sidebar-width) 1fr; }
.markbook-sidebar {
  position: sticky;
  top: calc(var(--mb-header-height) + 1.5rem);
  align-self: start;
  max-height: calc(100vh - var(--mb-header-height) - 3rem);
  overflow-y: auto;
}
.markbook-nav-group + .markbook-nav-group { margin-top: 1rem; }
.markbook-nav-group h2 {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--mb-fg-muted);
  margin: 0 0 0.5rem;
  padding-left: 0.5rem;
}
.markbook-nav-group ul { list-style: none; padding: 0; margin: 0; }
.markbook-nav-group li a {
  display: block;
  padding: 0.4rem 0.65rem;
  font-size: 0.9rem;
  color: var(--mb-fg);
  border-radius: var(--mb-radius);
}
.markbook-nav-group li a:hover { background: var(--mb-bg-elev); text-decoration: none; }
.markbook-nav-group li a.active { background: var(--mb-accent); color: var(--mb-accent-fg); }
.markbook-nav-group li a.active:hover { text-decoration: none; }
.markbook-main { min-width: 0; }
.markbook-content { max-width: var(--mb-content-width); }
.markbook-content > *:first-child { margin-top: 0; }
.markbook-content > h1 + p {
  font-size: 1.05rem;
  color: var(--mb-fg-muted);
  margin-top: 0;
  margin-bottom: 1.5rem;
}
.markbook-content h1 {
  font-size: 2.25rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  line-height: 1.15;
}
.markbook-content h2 {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 2rem 0 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--mb-border);
  scroll-margin-top: 80px;
}
.markbook-content h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1.25rem 0 0.5rem;
  scroll-margin-top: 80px;
}
.markbook-content p { margin: 0.75rem 0; }
.markbook-content code {
  font-family: var(--mb-font-mono);
  font-size: 0.85em;
  background: var(--mb-code-bg);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}
.markbook-content pre {
  margin: 0;
  padding: 0;
  background: transparent;
  font-size: 0.85rem;
  line-height: 1.55;
}
.markbook-content pre code { background: transparent; padding: 0; }
.markbook-story-block { margin: 1rem 0; }
.markbook-story {
  padding: 2rem;
  border: 1px solid var(--mb-border);
  border-radius: var(--mb-radius) var(--mb-radius) 0 0;
  background: var(--mb-bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
}
.markbook-story.markbook-story--centered {
  align-items: center;
  justify-content: center;
}
.markbook-story.markbook-story--padded { padding: 3rem 2rem; }
.markbook-story.markbook-story--fullscreen {
  padding: 0;
  min-height: 360px;
  align-items: stretch;
  justify-content: stretch;
}
.markbook-controls {
  border-left: 1px solid var(--mb-border);
  border-right: 1px solid var(--mb-border);
  background: var(--mb-bg);
  padding: 0.75rem 1rem;
  display: grid;
  grid-template-columns: minmax(80px, max-content) 1fr;
  gap: 0.5rem 0.85rem;
  font-size: 0.85rem;
}
.markbook-controls:empty { display: none; }
.markbook-playground {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  border-left: 1px solid var(--mb-border);
  border-right: 1px solid var(--mb-border);
  background: var(--mb-bg);
  padding: 0.5rem 1rem;
}
.markbook-playground-btn {
  appearance: none;
  border: 1px solid var(--mb-border);
  background: var(--mb-bg-soft);
  color: var(--mb-fg-muted);
  font-family: var(--mb-font-sans);
  font-size: 0.78rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  transition: border-color .12s ease, color .12s ease, background .12s ease;
}
.markbook-playground-btn:hover {
  border-color: var(--mb-accent);
  color: var(--mb-fg);
  background: var(--mb-bg-elev);
}
.markbook-playground-btn:focus-visible {
  outline: 2px solid var(--mb-accent);
  outline-offset: 2px;
}
.markbook-page-actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin: -0.5rem 0 1.5rem;
}
.markbook-page-action {
  appearance: none;
  border: 1px solid var(--mb-border);
  background: var(--mb-bg-soft);
  color: var(--mb-fg-muted);
  font-family: var(--mb-font-sans);
  font-size: 0.78rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  text-decoration: none;
  transition: border-color .12s ease, color .12s ease, background .12s ease;
}
.markbook-page-action:hover {
  border-color: var(--mb-accent);
  color: var(--mb-fg);
  background: var(--mb-bg-elev);
}
.markbook-page-action:focus-visible {
  outline: 2px solid var(--mb-accent);
  outline-offset: 2px;
}
.markbook-page-action.is-copied {
  border-color: var(--mb-accent);
  color: var(--mb-accent);
}
.markbook-control { display: contents; }
.markbook-control label {
  font-family: var(--mb-font-mono);
  font-size: 0.78rem;
  color: var(--mb-fg-muted);
  align-self: center;
  white-space: nowrap;
}
.markbook-control input[type="text"],
.markbook-control input[type="number"],
.markbook-control select {
  font-family: var(--mb-font-sans);
  font-size: 0.85rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--mb-border);
  border-radius: 4px;
  background: var(--mb-bg-elev);
  color: var(--mb-fg);
  width: 100%;
}
.markbook-control input[type="checkbox"] {
  align-self: center;
  width: 14px;
  height: 14px;
  margin: 0;
  justify-self: start;
}
.markbook-code {
  border: 1px solid var(--mb-border);
  border-top: none;
  border-radius: 0 0 var(--mb-radius) var(--mb-radius);
  background: var(--mb-bg);
}
.markbook-code summary {
  cursor: pointer;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  color: var(--mb-fg-muted);
  user-select: none;
}
.markbook-code summary:hover { color: var(--mb-fg); }
.markbook-code[open] summary { border-bottom: 1px solid var(--mb-border); }
.markbook-code pre { padding: 1rem; margin: 0; overflow-x: auto; }
.markbook-code-file + .markbook-code-file { border-top: 1px solid var(--mb-border); }
.markbook-code-file-label {
  padding: 0.4rem 1rem;
  font-size: 0.75rem;
  font-family: var(--mb-font-mono);
  color: var(--mb-fg-muted);
  background: var(--mb-bg-soft);
  border-bottom: 1px solid var(--mb-border);
}
.markbook-code-pre-wrap { position: relative; }
.markbook-code-copy {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  appearance: none;
  border: 1px solid var(--mb-border);
  background: var(--mb-bg);
  color: var(--mb-fg-muted);
  font-family: var(--mb-font-sans);
  font-size: 0.72rem;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity .12s ease, color .12s ease, border-color .12s ease;
}
.markbook-code-pre-wrap:hover .markbook-code-copy,
.markbook-code-copy:focus-visible { opacity: 1; }
.markbook-code-copy:hover { color: var(--mb-fg); border-color: var(--mb-accent); }
.markbook-code-copy.is-copied { opacity: 1; color: var(--mb-accent); border-color: var(--mb-accent); }
.markbook-code-copy:focus-visible { outline: 2px solid var(--mb-accent); outline-offset: 2px; }

/* Fenced markdown code blocks (triple-backtick blocks in any page).
   Layered AFTER the global .markbook-content .shiki rules so the bg
   override wins. */
.markbook-content .markbook-code-pre-wrap.markbook-fenced-code {
  margin: 1rem 0;
  border: 1px solid var(--mb-border);
  border-radius: var(--mb-radius);
  overflow: hidden;
  background: var(--mb-code-bg);
}
.markbook-content .markbook-fenced-code pre {
  margin: 0;
  padding: 1rem 1.25rem;
  overflow-x: auto;
  background: transparent;
}
.markbook-content .markbook-fenced-code pre code {
  background: transparent;
  padding: 0;
  font-size: 0.85em;
}
.markbook-content .markbook-fenced-code .shiki,
.markbook-content .markbook-fenced-code .shiki span {
  background-color: transparent;
}
.markbook-heading-anchor {
  display: inline-block;
  margin-left: 0.35rem;
  color: var(--mb-fg-muted);
  font-weight: 400;
  text-decoration: none;
  opacity: 0;
  transition: opacity .12s ease, color .12s ease;
}
.markbook-content h2:hover .markbook-heading-anchor,
.markbook-content h3:hover .markbook-heading-anchor,
.markbook-heading-anchor:focus-visible { opacity: 1; }
.markbook-heading-anchor:hover { color: var(--mb-accent); }
.markbook-heading-anchor:focus-visible { outline: 2px solid var(--mb-accent); outline-offset: 2px; border-radius: 3px; }
.markbook-code-tablist {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  background: var(--mb-bg-soft);
  border-bottom: 1px solid var(--mb-border);
  padding: 0 0.5rem;
}
.markbook-code-tablist [role="tab"] {
  appearance: none;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.5rem 0.75rem;
  font-family: var(--mb-font-mono);
  font-size: 0.75rem;
  color: var(--mb-fg-muted);
  cursor: pointer;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}
.markbook-code-tablist [role="tab"]:hover { color: var(--mb-fg); }
.markbook-code-tablist [role="tab"][aria-selected="true"] {
  color: var(--mb-fg);
  border-bottom-color: var(--mb-accent);
}
.markbook-code-tablist [role="tab"]:focus-visible {
  outline: 2px solid var(--mb-accent);
  outline-offset: -2px;
}
.markbook-code-tabs [role="tabpanel"] { display: block; }
.markbook-code-tabs [role="tabpanel"][hidden] { display: none; }
.markbook-code-tabs pre { padding: 1rem; margin: 0; overflow-x: auto; }
.markbook-props {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.875rem;
  border: 1px solid var(--mb-border);
  border-radius: var(--mb-radius);
  overflow: hidden;
}
.markbook-props th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  background: var(--mb-bg-elev);
  border-bottom: 1px solid var(--mb-border);
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--mb-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.markbook-props td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--mb-border);
  vertical-align: top;
}
.markbook-props tr:last-child td { border-bottom: none; }
.markbook-props code { font-size: 0.85em; word-break: break-word; }
.markbook-required { color: #d23; font-weight: 700; margin-left: 2px; }
.markbook-toc {
  position: sticky;
  top: calc(var(--mb-header-height) + 1.5rem);
  align-self: start;
  max-height: calc(100vh - var(--mb-header-height) - 3rem);
  overflow-y: auto;
  font-size: 0.85rem;
}
.markbook-toc h3 {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--mb-fg-muted);
  margin: 0 0 0.5rem;
}
.markbook-toc ul { list-style: none; padding: 0; margin: 0; }
.markbook-toc li a {
  display: block;
  padding: 0.25rem 0.5rem;
  color: var(--mb-fg-muted);
  font-size: 0.85rem;
  border-radius: 4px;
}
.markbook-toc li a:hover { color: var(--mb-fg); background: var(--mb-bg-elev); text-decoration: none; }
.markbook-toc li.toc-h3 a { padding-left: 1.25rem; font-size: 0.8rem; }
@media (max-width: 1100px) {
  .markbook-shell { grid-template-columns: var(--mb-sidebar-width) 1fr; }
  .markbook-toc { display: none; }
}
@media (max-width: 700px) {
  .markbook-shell { grid-template-columns: 1fr; padding: 1rem; }
  .markbook-header { padding: 0 0.75rem; gap: 0.5rem; }
  .markbook-search-ui { flex: 1 1 0; min-width: 0; width: auto; max-width: none; margin-left: 0; }
  .markbook-search-ui .pagefind-ui__drawer {
    width: calc(100vw - 1.5rem);
    max-width: none;
    right: 0;
    left: auto;
  }
  .markbook-nav-toggle { display: inline-flex; }
  /* Mobile sidebar: full viewport width below the header (Starlight pattern).
     Covers the page entirely so no backdrop is needed; the toggle button +
     ESC + nav-link clicks are the dismiss affordances. Slides in from left
     via translateX so reduced-motion users see no animation.
     align-self: stretch overrides the desktop rule's align-self: start —
     without this, browsers size the fixed-position sidebar to its intrinsic
     content height (so the bottom inset is ignored). */
  .markbook-sidebar {
    position: fixed;
    top: var(--mb-header-height);
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 11;
    align-self: stretch;
    width: auto;
    max-width: none;
    max-height: none;
    padding: 1.25rem 1.5rem 2rem;
    background: var(--mb-bg);
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  body[data-markbook-nav-open] .markbook-sidebar {
    transform: translateX(0);
  }
  body[data-markbook-nav-open] { overflow: hidden; }
  /* The backdrop is unused on mobile (sidebar covers the page) but stays
     in the DOM so layout authors can opt into a half-screen drawer pattern
     by un-hiding it from their own stylesheet. */
  body[data-markbook-nav-open] .markbook-nav-backdrop { display: none; }
  /* Bigger, more tappable nav rows on mobile. */
  .markbook-nav-group li a {
    padding: 0.6rem 0.85rem;
    font-size: 1rem;
  }
  .markbook-nav-group h2 {
    font-size: 0.75rem;
    padding-left: 0.85rem;
    margin-bottom: 0.65rem;
  }
  .markbook-nav-group + .markbook-nav-group { margin-top: 1.25rem; }
}
@media (prefers-reduced-motion: reduce) {
  .markbook-sidebar { transition: none; }
}
`;

export interface InlineAssets {
  themeBoot: string;
  tabsBoot: string;
  playgroundBoot: string;
  copyBoot: string;
  permalinkBoot: string;
  searchKbdBoot: string;
  copyMdBoot: string;
  navToggleBoot: string;
  /** Speculation Rules JSON for `<script type="speculationrules">` (prefetch). */
  speculationRules: string;
  baseCss: string;
}

let minifyPromise: Promise<void> | null = null;

/**
 * Minify every inline asset exactly once per process. Concurrent callers
 * share the same in-flight promise, so two `createContext` calls never
 * double-minify.
 */
export function ensureInlineAssetsMinified(): Promise<void> {
  if (!minifyPromise) minifyPromise = doMinify();
  return minifyPromise;
}

async function doMinify(): Promise<void> {
  const [
    themeMin,
    tabsMin,
    playgroundMin,
    copyMin,
    permalinkMin,
    searchKbdMin,
    copyMdMin,
    navToggleMin,
    baseCssMin,
  ] = await Promise.all([
    minifyJs(THEME_BOOT_SCRIPT),
    minifyJs(TABS_BOOT_SCRIPT),
    minifyJs(PLAYGROUND_BOOT_SCRIPT),
    minifyJs(COPY_BOOT_SCRIPT),
    minifyJs(PERMALINK_BOOT_SCRIPT),
    minifyJs(SEARCH_KBD_BOOT_SCRIPT),
    minifyJs(COPY_MD_BOOT_SCRIPT),
    minifyJs(NAV_TOGGLE_BOOT_SCRIPT),
    minifyCss(BASE_CSS),
  ]);
  THEME_BOOT_SCRIPT = themeMin;
  TABS_BOOT_SCRIPT = tabsMin;
  PLAYGROUND_BOOT_SCRIPT = playgroundMin;
  COPY_BOOT_SCRIPT = copyMin;
  PERMALINK_BOOT_SCRIPT = permalinkMin;
  SEARCH_KBD_BOOT_SCRIPT = searchKbdMin;
  COPY_MD_BOOT_SCRIPT = copyMdMin;
  NAV_TOGGLE_BOOT_SCRIPT = navToggleMin;
  BASE_CSS = baseCssMin;
}

/** Current snapshot of the inline assets (minified once the minify resolves). */
export function getInlineAssets(): InlineAssets {
  return {
    themeBoot: THEME_BOOT_SCRIPT,
    tabsBoot: TABS_BOOT_SCRIPT,
    playgroundBoot: PLAYGROUND_BOOT_SCRIPT,
    copyBoot: COPY_BOOT_SCRIPT,
    permalinkBoot: PERMALINK_BOOT_SCRIPT,
    searchKbdBoot: SEARCH_KBD_BOOT_SCRIPT,
    copyMdBoot: COPY_MD_BOOT_SCRIPT,
    navToggleBoot: NAV_TOGGLE_BOOT_SCRIPT,
    speculationRules: SPECULATION_RULES,
    baseCss: BASE_CSS,
  };
}
