import {
  applyParameters,
  injectCss,
  resolveMountTarget,
  type BaseMountOptions,
} from '@markbook/adapter-shared';

type MountOptions = BaseMountOptions;

/**
 * Mount a web-components story into the placeholder element.
 *
 * The story export may be:
 *   - a function returning an HTML string (set as `innerHTML`)
 *   - a function returning a `Node` (appended)
 *   - an HTMLElement / Node directly (appended)
 *   - a string (set as `innerHTML`)
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
    result = (story as () => unknown)();
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

export type { StoryParameters } from '@markbook/adapter-shared';
