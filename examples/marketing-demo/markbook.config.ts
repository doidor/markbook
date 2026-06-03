import { defineConfig } from '@markbook/core';

/**
 * Cumulus — a fictional cloud-platform marketing site.
 *
 * This demo is the polar opposite of the React / Vue / WC docs demos.
 * It exercises Markbook's deepest customization layers:
 *
 *   - `disableBaseCss: true` — Markbook ships ZERO chrome CSS. We supply
 *     every rule via `cumulus.css`.
 *   - `transformHtml` — post-processes each page's HTML to swap the docs
 *     chrome (header / left sidebar / right TOC) for a marketing layout
 *     (top nav / hero / sections / footer).
 *   - `llmsButtons: false` — no "View as Markdown" buttons on a marketing
 *     site; readers aren't trying to feed pages to ChatGPT.
 *
 * The result reads like a startup landing page, not a docs site, and
 * proves Markbook isn't locked into the docs UI.
 */

const NAV = [
  { href: '/index.html', label: 'Home' },
  { href: '/product.html', label: 'Product' },
  { href: '/pricing.html', label: 'Pricing' },
  { href: '/customers.html', label: 'Customers' },
  { href: '/contact.html', label: 'Contact' },
];

function topNavHtml(currentPath: string): string {
  const items = NAV.map((n) => {
    const active = currentPath === n.href ? ' aria-current="page"' : '';
    return `<a href="${n.href}"${active}>${n.label}</a>`;
  }).join('');
  return `<nav class="cumulus-topnav" aria-label="Site"><a class="cumulus-brand" href="/index.html"><span class="cumulus-logo" aria-hidden>◢</span> Cumulus</a><div class="cumulus-topnav-items">${items}</div><a class="cumulus-cta-sm" href="/contact.html">Talk to sales →</a></nav>`;
}

const FOOTER_HTML = `<footer class="cumulus-footer">
  <div class="cumulus-footer-grid">
    <div>
      <div class="cumulus-brand cumulus-brand-footer"><span class="cumulus-logo" aria-hidden>◢</span> Cumulus</div>
      <p class="cumulus-footer-tagline">Cloud infrastructure that gets out of your way.</p>
    </div>
    <div>
      <h4>Product</h4>
      <ul><li><a href="/product.html">Features</a></li><li><a href="/pricing.html">Pricing</a></li><li><a href="/customers.html">Customers</a></li></ul>
    </div>
    <div>
      <h4>Company</h4>
      <ul><li><a href="/contact.html">Contact</a></li><li><a href="#">Careers</a></li><li><a href="#">Press</a></li></ul>
    </div>
    <div>
      <h4>Resources</h4>
      <ul><li><a href="#">Docs</a></li><li><a href="#">Status</a></li><li><a href="#">Changelog</a></li></ul>
    </div>
  </div>
  <div class="cumulus-footer-bottom">© Cumulus Cloud Inc. · Built with Markbook.</div>
</footer>`;

export default defineConfig({
  description: 'Cumulus — cloud infrastructure that gets out of your way.',
  disableBaseCss: true,
  css: ['./cumulus.css'],
  llmsButtons: false,
  transformHtml: async (html, page) => {
    // 1. Drop the default chrome: header, sidebar, TOC, shell div.
    let out = html
      .replace(/<header class="markbook-header">[\s\S]*?<\/header>/, '')
      .replace(/<aside class="markbook-sidebar">[\s\S]*?<\/aside>/, '')
      .replace(/<aside class="markbook-toc">[\s\S]*?<\/aside>/, '')
      .replace(/<div class="markbook-shell[^"]*">/, '<div class="cumulus-shell">');

    // 2. Inject our top nav at the start of body, footer at the end.
    out = out
      .replace(/<body>/, `<body>${topNavHtml('/' + page.htmlRelPath)}`)
      .replace(/<\/body>/, `${FOOTER_HTML}</body>`);

    // 3. Page-specific hero on index.html only — wrap the H1 + its first
    //    paragraph in a `<section class="cumulus-hero">` for the landing
    //    treatment (full-width gradient, two CTAs).
    if (page.htmlRelPath === 'index.html') {
      out = out.replace(
        /<article class="markbook-content"[^>]*>([\s\S]*?)<\/article>/,
        (_full, body) => {
          // Extract the H1 + first <p> for the hero; the rest stays under it.
          const heroMatch = body.match(/^([\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>\s*<p>[\s\S]*?<\/p>)/);
          if (!heroMatch) return `<article class="markbook-content">${body}</article>`;
          const heroBody = heroMatch[1];
          const rest = body.slice(heroBody.length);
          return `<section class="cumulus-hero"><div class="cumulus-hero-inner">${heroBody}<div class="cumulus-hero-ctas"><a class="cumulus-cta-primary" href="/contact.html">Start free</a><a class="cumulus-cta-secondary" href="/product.html">See the product →</a></div></div></section><article class="cumulus-content">${rest}</article>`;
        },
      );
    } else {
      // Other pages: just rename the article class so our CSS targets it.
      out = out.replace(
        /<article class="markbook-content"[^>]*>/,
        '<article class="cumulus-content">',
      );
    }

    return out;
  },
});
