---
name: add-stories
description: Scaffold a multi-export <Component>.stories.tsx (Storybook CSF v3 idiom) and wire it into the matching docs page with a :::stories directive.
trigger: When asked to add multiple variants for a component, or convert N singleton story files into one multi-export file.
allowed-tools: Bash Read Grep Glob Edit Create
argument-hint: <ComponentName> <ExportName1,ExportName2,...>
---

# add-stories

Multi-export files are the right shape when a component has many small
variants. Each named export becomes its own H3, its own placeholder, and its
own per-export code disclosure — the disclosure shows imports + non-export
helpers + just that export, sliced via the TS compiler API.

## Inputs

- `ComponentName` — must already exist at `examples/react-demo/src/pixie/<ComponentName>.tsx`.
- `ExportName1,ExportName2,…` — PascalCase, comma-separated (`Primary`, `Secondary`, `Disabled`, `WithImage`, …).

## Steps

1. **Verify the component exists** (`view src/pixie/<ComponentName>.tsx`).
2. **Verify the page exists** (`view docs/components/<ComponentName>.md`).
3. **If singleton story files already exist** under `docs/components/<ComponentName>/`, delete them and migrate their contents into the new multi-export file. Document the migration in `/progress-log` afterwards.
4. **Create the multi-export file** at `examples/react-demo/docs/components/<ComponentName>/<ComponentName>.stories.tsx`:
   ```tsx
   import { ComponentName } from '../../../src/pixie/ComponentName.js';

   export const Primary = () => <ComponentName /* primary props */ />;

   export const Secondary = () => <ComponentName /* secondary props */ />;

   /** CSF v3 object: render function + metadata. */
   export const Featured = {
     name: 'Featured variant',
     parameters: { layout: 'centered' as const },
     render: () => <ComponentName /* featured props */ />,
   };
   ```
   - Each export is EITHER a render function OR a CSF v3 object (`{ render, args?, argTypes?, parameters?, name? }`).
   - CSF detection requires `render` AND at least one metadata field. Without metadata it would be treated as a plain component (which is what protects Vue `defineComponent({ render })` and React `forwardRef` from being mis-classified).
   - Reserved export names that are NOT fanned out: `default`, `args`, `argTypes`, `parameters`, and any leading-`_` private.
5. **Edit the docs page** body — replace any singleton blocks with one `:::stories` directive:
   ```md
   :::stories{src=./ComponentName/ComponentName.stories.tsx}
   :::
   ```
   Optional attributes:
   - `only=Primary,Secondary` — whitelist exports
   - `exclude=Internal` — blacklist exports
   - `id=base-slug` — base embed slug; per-story becomes `${id}-${kebab(exportName)}`
6. **Run [`/verify-build`](../verify-build/SKILL.md)** — the rendered page should have N H3s, N story-blocks (each with `data-markbook-group`), and N per-export disclosures.
7. **Run [`/progress-log`](../progress-log/SKILL.md)** if this is a non-trivial change (new variants for an existing component, or migrating singletons to multi-export).

## Prevention tests

- File ends in `.stories.tsx` (or `.ts`).
- At least one named export survives reserved-name filtering.
- The directive in markdown is `:::stories` (plural), NOT `:::story` (singular is for single-renderer files).
- CSF objects (if any) include `render` AND at least one of `args`/`argTypes`/`parameters`/`name`.
- The component is imported with the `.js` extension (per the project's resolution convention).

## Related ADRs
- ADR-0018 — `:::stories` is a separate directive (not a `:::story` overload)
