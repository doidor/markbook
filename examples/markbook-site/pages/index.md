---
title: Markbook
description: Agent-first, markdown-first. A static-site engine that ships with first-class agent skills for setup, theming, and bundling — plus a React adapter for component stories when you need them.
layout: landing
---

<section class="site-section">
  <h2>Agent-first by default</h2>
  <p class="site-section-lede">
    Markbook ships with six built-in <a href="./guides/agent-skills.html">agent skills</a> — installable into Claude Code, Codex, OpenCode, Cursor, or any agent CLI that auto-discovers skills. Setting up docs is a one-line conversation, not a config-file safari.
  </p>

  <div class="site-hero-spotlight">
    <h3>Zero-friction setup</h3>
    <p>One <code>npx markbook skills install</code> drops six procedural skills into your agent surface. Then: <em>"Set up Markbook in this project"</em> → <em>"Generate docs for everything under <code>src/components</code>"</em> → <em>"Apply the github preset, accent <code>#0969da</code>"</em> → done. <a href="./guides/agent-skills.html">See the skills →</a></p>
  </div>
</section>

<section class="site-section">
  <h2>What it is</h2>
  <p class="site-section-lede">
    Markbook turns a directory of markdown files into a static HTML site,
    with built-in search, dark mode, llms.txt, sitemap, and OG tags.
    A thin React adapter lets you mount component
    stories into the same pages — turning the same engine into a
    Storybook alternative when you need one. (Vue and web-component
    adapters are on the roadmap.)
  </p>

  <div class="site-feature-grid">
    <div class="site-feature">
      <div class="site-feature-icon">🤖</div>
      <h3>Agent-first by default</h3>
      <p>Six built-in <a href="./guides/agent-skills.html">agent skills</a> for scaffolding, generating, theming, and bundling. Installable into <code>.claude/</code>, <code>.codex/</code>, <code>.opencode/</code>, <code>.agents/</code> with one command. <em>Conventions, encoded.</em></p>
    </div>
    <div class="site-feature">
      <div class="site-feature-icon">📄</div>
      <h3>Markdown is the source of truth</h3>
      <p>Every page is a `.md` file. HTML and llms.txt are two views of one AST. No MDX, no JSON sidecars, no JS templates to learn.</p>
    </div>
    <div class="site-feature">
      <div class="site-feature-icon">🧩</div>
      <h3>Component stories, optional</h3>
      <p>Drop a <code>:::story</code> directive in any page to mount a React component story. Skip the directive — and the adapter — for pure docs sites. (Vue and web-component adapters are planned.)</p>
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
    <a class="site-guide-card" href="./guides/agent-skills.html">
      <strong>Agent skills →</strong>
      <span>Markbook ships six agent skills for scaffolding, generating, theming, and bundling — installable into your agent CLI with one command.</span>
    </a>
    <a class="site-guide-card" href="./guides/adding-stories.html">
      <strong>Adding component stories →</strong>
      <span>Wire up the React adapter, drop your first <code>:::story</code> directive, view it in the docs.</span>
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
    <a class="site-guide-card" href="./reference/skills.html">
      <strong>Skills reference →</strong>
      <span>Every flag of every shipped skill — the deep-dive for writing an <code>AGENTS.md</code> or pinning a procedure.</span>
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
