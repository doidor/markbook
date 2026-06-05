/**
 * Runtime helper source injected into generated story entry modules (both
 * the per-page entries from `build.ts` and the embed/package entries from
 * `embed.ts`). Kept here so the two generators stay byte-identical.
 *
 * `__mb_isCsf(v)` distinguishes a Storybook CSF v3 story object
 * (`{ render, args?, argTypes?, parameters?, name? }`) from a plain
 * component object (e.g. Vue's `defineComponent({ render })` or React's
 * `forwardRef`). To count as CSF, the value must be a non-null object with
 * a `render` function AND at least one CSF metadata field — otherwise we'd
 * unwrap arbitrary component objects that merely expose a `render` method.
 */
export const MB_CSF_HELPER = `function __mb_isCsf(v) {
  if (!v || typeof v !== 'object') return false;
  if (typeof v.render !== 'function') return false;
  return !!(v.args || v.argTypes || v.parameters || typeof v.name === 'string');
}`;
