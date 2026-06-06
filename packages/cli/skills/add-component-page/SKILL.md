---
name: markbook-add-component-page
description: Generate one Markbook docs page (frontmatter + :::props + :::stories) for a single component file.
trigger: When the user wants to document a specific component, e.g. "add a Markbook page for src/components/Button.tsx".
allowed-tools: Bash Read Grep Glob Edit Create
argument-hint: <component-path> [--output <docs-path>]
---

# markbook-add-component-page

Generate one Markbook docs page for one component file. The page wires up
`component:` (for the auto-generated props table) and a `:::stories`
directive against a sibling stories file scaffold.

## Inputs

- **`component-path`** (required) — path to the component source file (`./src/components/Button.tsx`, `@my-org/button`, etc.). Relative paths, absolute paths, and bare specifiers are all supported (see ADR-0021 — `component:` accepts the full spectrum).
- **`--output <docs-path>`** (optional) — destination markdown file. Defaults to `docs/components/<Name>.md` where `<Name>` is the component's basename minus extension.

## Steps

1. **Resolve and read the component.**
   - If `component-path` is relative or absolute, `view <path>`.
   - If bare, walk `node_modules` to find the package's main entry. Read.
   - Detect the **primary export name** — convention is PascalCase named export matching the file basename, or the `default` export.
   - Extract the JSDoc summary above the component (if present) — use as the `description:`.
2. **Choose the storyfile location.** Conventionally a sibling of the docs page: `<docs-path-dir>/<Name>/<Name>.stories.tsx`. Confirm the path with the user before writing.
3. **Generate the docs page.**
   ```md
   ---
   title: <Name>
   description: <JSDoc summary, or the user's input>
   template: component   # only if `_layouts/component.md` exists in the project
   component: <relative-from-page-dir or bare>
   componentExport: <detected name>
   ---

   :::stories{src=./<Name>/<Name>.stories.tsx}
   :::
   ```
   - Skip `template:` if no `_layouts/component.md` template is configured.
   - Skip `componentExport:` if the file has a single export (Markbook auto-detects).
4. **Generate the stories file with one starter export.**
   ```tsx
   import { <Name> } from '<same import the user uses in their app>';

   export const Default = () => <<Name> />;
   ```
   For multi-export starters see [`/markbook-bulk-generate`](../bulk-generate/SKILL.md).
5. **Run `markbook build`** (or suggest the user does) to confirm the page renders. The props table will populate if the component exports a TypeScript interface that the props extract can read.
6. **Print "next steps".**
   - "Open `<output>` to customize the page."
   - "Edit `<storyfile>` to add more variants — see `/markbook-bulk-generate` to do many at once."

## Edge cases

- **No detectable component export.** Tell the user the file doesn't look like a React component. Suggest naming the export PascalCase and re-running.
- **JSDoc absent.** Use a placeholder description (`'TODO: describe <Name>'`) and call it out in the "next steps" so the user knows to fill it in.
- **Component without TypeScript types.** The props table won't have columns. Note this and link to `@types/...` packages if the framework is React.

## Prevention tests

- The generated page's `component:` value resolves from the page's directory (`resolveSpec` will run on it at build time).
- The generated stories file imports the component using the same specifier the user's app would use (relative path or bare).
- `<Name>` is PascalCase and matches the file basename.
- For multi-component files (one file exporting both `Button` and `ButtonGroup`), this skill handles ONE export per invocation — the user runs it twice or uses `/markbook-bulk-generate`.

## Related
- ADR-0021 — bare-specifier resolution for path-like frontmatter fields
- [`/markbook-bulk-generate`](../bulk-generate/SKILL.md) — many pages at once
