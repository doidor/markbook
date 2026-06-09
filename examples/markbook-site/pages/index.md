---
title: Markbook
description: Agent-first, markdown-first. A static-site engine that ships with first-class agent skills for setup, theming, and bundling — plus a React adapter for component stories when you need them.
layout: landing
---

<section class="site-section">
  <h2>Agent-first by default</h2>
  <p class="site-section-lede">
    Markbook ships six built-in <a href="./guides/agent-skills.html">agent skills</a> for Claude Code, Codex, OpenCode, Cursor, and any agent CLI that auto-discovers skills. Setting up docs is a one-line conversation, not a config-file safari.
  </p>

  <div class="site-hero-spotlight">
    <p>One <code>npx markbook skills install</code> and then: <em>"Set up Markbook in this project"</em> → <em>"Generate docs for everything under <code>src/components</code>"</em> → <em>"Apply the github preset, accent <code>#0969da</code>"</em> → done. <a href="./guides/agent-skills.html">See the skills →</a></p>
  </div>
</section>

<section class="site-section">
  <h2>What it is</h2>
  <p class="site-section-lede">
    Markbook turns a directory of markdown files into a static HTML site, with
    built-in search, dark mode, llms.txt, sitemap, and OG tags. A thin React
    adapter lets you mount component stories into the same pages — turning the
    same engine into a Storybook alternative when you need one. (Vue and
    web-component adapters are on the roadmap.)
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
      <p>Drop a <code>:::story</code> directive in any page to mount a React component story. Skip the directive — and the adapter — for pure docs sites.</p>
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

  <div class="site-guide-grid">
    <a class="site-guide-card" href="./guides/getting-started.html">
      <strong>Getting started →</strong>
      <span>Install, scaffold a project, run the dev server. Five minutes from zero to your first page.</span>
    </a>
    <a class="site-guide-card" href="./guides/agent-skills.html">
      <strong>Agent skills →</strong>
      <span>Six shipped skills for scaffolding, generating, theming, and bundling — installable into your agent CLI with one command.</span>
    </a>
    <a class="site-guide-card" href="./guides/adding-stories.html">
      <strong>Adding component stories →</strong>
      <span>Wire up the React adapter, drop your first <code>:::story</code> directive, view it in the docs.</span>
    </a>
    <a class="site-guide-card" href="./guides/customization.html">
      <strong>Customization →</strong>
      <span>The four-layer model — tokens, disabling base CSS, custom HTML layouts, post-processing.</span>
    </a>
    <a class="site-guide-card" href="./guides/custom-directives.html">
      <strong>Custom directives →</strong>
      <span>Register your own <code>:::name</code> directives. Build admonitions, video embeds, diagram renderers — any reusable markdown vocabulary your team needs.</span>
    </a>
    <a class="site-guide-card" href="./reference/config.html">
      <strong>Reference →</strong>
      <span>Every <code>MarkbookConfig</code> field, every CLI flag, every directive and frontmatter key.</span>
    </a>
  </div>
</section>

<section class="site-section">
  <h2>What you don't need</h2>
  <p class="site-section-lede">
    Markbook is small on purpose. No MDX (use a story directive — your component file stays a regular <code>.tsx</code>). No theme engine (customize via CSS tokens or replace the shell — no provider hierarchy, no plugin framework). No bundled UI framework (the engine is plain HTML + minified IIFE boot scripts; bring React for stories if you want them).
  </p>
</section>
