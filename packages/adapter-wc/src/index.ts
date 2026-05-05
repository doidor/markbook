/**
 * Mount a web-components story into the placeholder element.
 *
 * The story export may be:
 *   - a function returning an HTML string (set as `innerHTML`)
 *   - a function returning a `Node` (appended)
 *   - an HTMLElement / Node directly (appended)
 *   - a string (set as `innerHTML`)
 */
export function mount(el: Element | null, story: unknown): void {
  if (!el) return;

  let result: unknown = story;
  if (typeof story === 'function') {
    result = (story as () => unknown)();
  }

  while (el.firstChild) el.removeChild(el.firstChild);

  if (typeof result === 'string') {
    el.innerHTML = result;
  } else if (result instanceof Node) {
    el.appendChild(result);
  } else {
    throw new Error(
      'Markbook (adapter-wc): story must be a string, an HTMLElement, or a function returning one of those',
    );
  }
}
