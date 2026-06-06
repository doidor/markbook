import {
  applyParameters,
  injectCss,
  resolveMountTarget,
  type BaseMountOptions,
} from '@markbook/adapter-shared';

type MountOptions = BaseMountOptions & {
  /**
   * Current props passed to the story when it's a function: `story(args)`.
   * The controls panel mutates this record in place and re-mounts, so a story
   * that reads `args` re-renders with the edited values.
   */
  args?: Record<string, unknown>;
};

/**
 * Mount a web-components story into the placeholder element.
 *
 * The story export may be:
 *   - a function returning an HTML string (set as `innerHTML`)
 *   - a function returning a `Node` (appended)
 *   - an HTMLElement / Node directly (appended)
 *   - a string (set as `innerHTML`)
 *
 * When the export is a function it receives the current `args` record, so
 * interactive controls can drive the rendered markup.
 *
 * Pass `{ isolation: 'shadow' }` to wrap the mount inside an open shadow root.
 * Pass `{ css, cssId }` (set automatically by the embed bundle) to apply the
 * bundle's stylesheet — injected into the shadow root when isolated, or
 * `document.head` otherwise.
 */
export function mount(el: Element | null, story: unknown, opts?: MountOptions): void {
  if (!el) return;

  applyParameters(el, opts?.parameters);
  const target = resolveMountTarget(el, opts?.isolation);
  injectCss(target, opts?.css, opts?.cssId);

  let result: unknown = story;
  if (typeof story === 'function') {
    result = (story as (args?: Record<string, unknown>) => unknown)(opts?.args);
  }

  while (target.firstChild) target.removeChild(target.firstChild);

  if (typeof result === 'string') {
    (target as HTMLElement).innerHTML = result;
  } else if (result instanceof Node) {
    target.appendChild(result);
  } else {
    throw new Error(
      'Markbook (adapter-wc): story must be a string, an HTMLElement, or a function returning one of those',
    );
  }
}

export type { MountOptions };
export type { StoryParameters } from '@markbook/adapter-shared';
export { setupControls } from '@markbook/adapter-shared';
export type { ArgType } from '@markbook/adapter-shared';
