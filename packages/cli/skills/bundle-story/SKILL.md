---
name: markbook-bundle-story
description: Produce a portable bundle of one Markbook story (embed or package mode) and walk through embedding it in an external host page.
trigger: When the user wants to embed a Markbook story on another site (marketing page, blog post, partner docs) or asks "how do I share a story externally?".
allowed-tools: Bash Read Grep Glob Edit Create
argument-hint: <storyId> [--mode embed|package] [--isolation shadow]
---

# markbook-bundle-story

Bundle one Markbook story into a portable artefact and embed it on an
external page. Two modes:

- **`embed`** (default) — self-mounting ESM, drop into any HTML page via a single `<script type="module">` tag. ~200 KB for a React story (framework bundled in).
- **`package`** — publishable npm-style directory; the host provides the framework as a peer dep. ~3.5 KB for a React story.

See ADR-0006 in Markbook's `DECISIONS.md` for the full design.

## Inputs

- **`storyId`** (required, positional) — the story's stable slug. Find it in the embed sandbox at `dist/embed/index.html` after a build (kebab-case, e.g. `components-button-variants` or `components-button-variants-primary` for `:::stories` fan-out exports).
- **`--mode <embed|package>`** (optional) — defaults to `embed`.
- **`--isolation <shadow>`** (optional) — wrap the mount inside an open shadow root so host-page CSS doesn't leak in.

## Steps

1. **Run a build first.** `markbook build` populates `dist/embed/index.html` which lists every available slug. If `storyId` was supplied, verify it's in that list.
2. **Bundle.**
   ```bash
   markbook bundle <storyId>                       # embed mode
   markbook bundle <storyId> --mode package        # package mode
   markbook bundle <storyId> --isolation shadow    # either mode + shadow
   ```
3. **Verify the output.**
   - Embed: `ls dist/embed/<storyId>.js` should exist.
   - Package: `ls dist/packages/<storyId>/` should contain `package.json`, `dist/index.js`, `README.md`.

4. **Embed on a host page.**

   ### Embed mode (simplest)
   ```html
   <div data-markbook-embed="<storyId>"></div>
   <script type="module" src="path/to/dist/embed/<storyId>.js"></script>
   ```
   The bundle auto-mounts on every `[data-markbook-embed]` placeholder it finds. Multiple instances on the same page work — same `storyId` mounts the story in each. Different storyIds need their own `<script>` per bundle.

   ### Package mode (needs framework provided by host)
   ```html
   <script type="importmap">
   {
     "imports": {
       "react": "https://esm.sh/react@18.3.1",
       "react-dom": "https://esm.sh/react-dom@18.3.1",
       "<storyId>": "path/to/dist/packages/<storyId>/dist/index.js"
     }
   }
   </script>
   <div id="here"></div>
   <script type="module">
     import { mount } from '<storyId>';
     mount(document.getElementById('here'));
   </script>
   ```
   In a real consumer project, replace the importmap with `npm install <pkgName>` + a bundler that resolves bare specifiers normally.

5. **Test it.** Open the host page in a browser. The story should render with full styling (the bundle's CSS is injected at mount time — light DOM by default, shadow root when `--isolation=shadow`).

6. **Common failure modes:**
   - **"duplicate story slug"** — two stories collide on the same slug. Add `:::story{... id=unique-slug}` to one of them.
   - **Story renders blank** — usually the host's placeholder `<div data-markbook-embed="...">` uses the wrong slug. Compare to the bundle filename.
   - **Story renders unstyled in shadow mode** — your component's CSS tokens are declared on `:root` only. Add `:host` to the selector list (see `.copilot/wiki/shadow-tokens-on-host-and-root.md` in markbook).

## Tips

- The embed sandbox at `dist/embed/index.html` is a working reference — it mounts every bundled story side-by-side with copy-pasteable markup snippets. Use it to spot-check before deploying.
- For `:::stories` fan-out files, each named export bundles to `<basename>-<kebab-export>.js`. Adding/removing exports later never silently renames an existing embed.

## Prevention tests

- Bundle filename matches the `storyId` argument (kebab-case, no `.js`).
- Host page's `data-markbook-embed` attribute equals the storyId exactly.
- For shadow isolation, host page CSS resets do NOT reach inside the shadow root (by design).
- Story file's relative imports stay resolvable in the bundled output (the bundler handles it; check the dist/embed/<storyId>.js if anything looks off).

## Related ADRs
- ADR-0006 — story portability (embed vs package mode)
- ADR-0012, ADR-0013 — implementation details
- ADR-0018 — `:::stories` slug promotion rules
