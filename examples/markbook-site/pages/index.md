---
title: Markbook
description: A library that renders markdown into HTML, with adapters for React, Vue, and web components — so it can also do component-library showcases like Storybook.
layout: landing
---

<section class="site-section">
  <h2>What it is</h2>
  <p class="site-section-lede">
    Markbook turns a directory of markdown files into a static HTML site,
    with built-in search, dark mode, llms.txt, sitemap, and OG tags.
    Three thin adapters let you mount React, Vue, or web-component
    stories into the same pages — turning the same engine into a
    Storybook alternative when you need one.
  </p>

  <div class="site-feature-grid">
    <div class="site-feature">
      <div class="site-feature-icon">📄</div>
      <h3>Markdown is the source of truth</h3>
      <p>Every page is a `.md` file. HTML and llms.txt are two views of one AST. No MDX, no JSON sidecars, no JS templates to learn.</p>
    </div>
    <div class="site-feature">
      <div class="site-feature-icon">🧩</div>
      <h3>Component stories, optional</h3>
      <p>Drop a <code>:::story</code> directive in any page to mount a React, Vue, or web-component story. Skip the directive — and the adapter — for pure docs sites.</p>
    </div>
    <div class="site-feature">
      <div class="site-feature-icon">🔍</div>
      <h3>Search + SEO by default</h3>
      <p>Pagefind builds a full-text index at build time. Canonical, Open Graph, Twitter Card, sitemap.xml, and robots.txt are emitted automatically.</p>
    </div>
    <div class="site-feature">
      <div class="site-feature-icon">🎨</div>
      <h3>Four layers of customization</h3>
      <p>Token overrides → opt-out of base CSS → swap the HTML shell with your own layouts → post-process the final HTML. Each layer is opt-in.</p>
    </div>
    <div class="site-feature">
      <div class="site-feature-icon">📦</div>
      <h3>Portable stories</h3>
      <p><code>markbook bundle</code> produces self-contained ESM embeds or publishable npm packages — stories that work anywhere, not just inside your docs site.</p>
    </div>
    <div class="site-feature">
      <div class="site-feature-icon">⚡</div>
      <h3>Fast dev loop</h3>
      <p>Vite under the hood. ~80ms regeneration on a 5-page site, including a full Pagefind re-index. Hot reload across markdown, CSS, layouts, and story files.</p>
    </div>
  </div>
</section>

<section class="site-section">
  <h2>Pick a starting point</h2>
  <p class="site-section-lede">
    Two reading paths, depending on what you're building.
  </p>

  <div class="site-hero-spotlight">
    <h3>Try the interactive demo</h3>
    <p>Explore a live React component demo built with Markbook — stories, variants, and interactive examples. <a href="./demos/react-demo/">Open the React demo →</a></p>
  </div>

  <div class="site-guide-grid">
    <a class="site-guide-card" href="./demos/react-demo/">
      <strong>React demo →</strong>
      <span>Live demo of the React component library built with Markbook. Available at <code>/demos/react-demo/</code> on the published docs site.</span>
    </a>
    <a class="site-guide-card" href="./guides/getting-started.html">
      <strong>Getting started →</strong>
      <span>Install, scaffold a project, run the dev server. Five minutes from zero to your first page.</span>
    </a>
    <a class="site-guide-card" href="./guides/adding-stories.html">
      <strong>Adding component stories →</strong>
      <span>Wire up an adapter (React / Vue / web components), drop your first <code>:::story</code> directive, view it in the docs.</span>
    </a>
    <a class="site-guide-card" href="./guides/customization.html">
      <strong>Customization →</strong>
      <span>The four-layer model — tokens, disabling base CSS, custom HTML layouts, post-processing. Pick the smallest one that solves your problem.</span>
    </a>
    <a class="site-guide-card" href="./guides/custom-directives.html">
      <strong>Custom directives →</strong>
      <span>Register your own <code>:::name</code> directives. Build admonitions, video embeds, diagram renderers — any reusable markdown vocabulary your team needs.</span>
    </a>
    <a class="site-guide-card" href="./guides/search-and-seo.html">
      <strong>Search & SEO →</strong>
      <span>How Pagefind is hooked in, how sitemap/OG/Twitter tags are emitted, where to put your <code>siteUrl</code>.</span>
    </a>
    <a class="site-guide-card" href="./reference/config.html">
      <strong>Config reference →</strong>
      <span>Every field of <code>MarkbookConfig</code>, with defaults and examples.</span>
    </a>
    <a class="site-guide-card" href="./reference/cli.html">
      <strong>CLI reference →</strong>
      <span><code>build</code>, <code>dev</code>, <code>preview</code>, <code>bundle</code>, <code>skills install</code> — every command, every flag.</span>
    </a>
  </div>
</section>

<section class="site-section">
  <h2>What you don't need</h2>
  <p class="site-section-lede">
    Markbook is small on purpose. Things it deliberately doesn't ship:
  </p>

  <div class="site-feature-grid">
    <div class="site-feature">
      <h3>No MDX</h3>
      <p>Markdown is markdown. If you need to embed components, use a story directive — your component file stays a regular <code>.tsx</code> file your tooling already understands.</p>
    </div>
    <div class="site-feature">
      <h3>No theme engine</h3>
      <p>Customize via CSS tokens or replace the shell entirely. No theme-prop API, no provider hierarchy, no plugin system to learn.</p>
    </div>
    <div class="site-feature">
      <h3>No bundled UI framework</h3>
      <p>Markbook itself is plain HTML + minified IIFE boot scripts. Bring React for stories if you want it; the engine doesn't care.</p>
    </div>
  </div>
</section>
