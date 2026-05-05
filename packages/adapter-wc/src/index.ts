interface MountOptions {
  isolation?: 'shadow';
}

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
 */
export function mount(el: Element | null, story: unknown, opts?: MountOptions): void {
  if (!el) return;

  const target = resolveMountTarget(el, opts);

  let result: unknown = story;
  if (typeof story === 'function') {
    result = (story as () => unknown)();
  }

  while (target.firstChild) target.removeChild(target.firstChild);

  if (typeof result === 'string') {
    (target as HTMLElement | ShadowRoot).innerHTML = result;
  } else if (result instanceof Node) {
    target.appendChild(result);
  } else {
    throw new Error(
      'Markbook (adapter-wc): story must be a string, an HTMLElement, or a function returning one of those',
    );
  }
}

function resolveMountTarget(el: Element, opts?: MountOptions): Element | ShadowRoot {
  if (opts?.isolation !== 'shadow') return el;
  const host = el as HTMLElement;
  let shadow = host.shadowRoot;
  if (!shadow) shadow = host.attachShadow({ mode: 'open' });
  return shadow;
}
