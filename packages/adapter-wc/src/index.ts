export interface StoryParameters {
  layout?: 'centered' | 'fullscreen' | 'padded';
  background?: string;
}

interface MountOptions {
  isolation?: 'shadow';
  /** Per-story display parameters applied to the placeholder element. */
  parameters?: StoryParameters;
  /** CSS string injected before mounting (Markbook embed bundle). */
  css?: string;
  /** Stable id used to dedup the light-DOM `<style>` tag. */
  cssId?: string;
}

const LAYOUT_CLASSES = [
  'markbook-story--centered',
  'markbook-story--fullscreen',
  'markbook-story--padded',
];

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
  const target = resolveMountTarget(el, opts);
  injectCss(target, opts);

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

function applyParameters(el: Element, params: StoryParameters | undefined): void {
  if (!params) return;
  const host = el as HTMLElement;
  for (const cls of LAYOUT_CLASSES) host.classList.remove(cls);
  if (params.layout) host.classList.add(`markbook-story--${params.layout}`);
  if (params.background !== undefined) host.style.background = params.background;
}

/**
 * Mirror the React/Vue adapters: when isolated, mount into a child
 * `.markbook-shadow-host` div inside the shadow root rather than the shadow
 * root itself. This way the `target.firstChild` cleanup loop above only
 * clears the rendered story, not any sibling `<style>` injected by
 * `injectCss`.
 */
function resolveMountTarget(el: Element, opts?: MountOptions): HTMLElement {
  if (opts?.isolation !== 'shadow') return el as HTMLElement;
  const host = el as HTMLElement;
  let shadow = host.shadowRoot;
  if (!shadow) shadow = host.attachShadow({ mode: 'open' });
  let container = shadow.querySelector('.markbook-shadow-host') as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.className = 'markbook-shadow-host';
    shadow.appendChild(container);
  }
  return container;
}

/** See `@markbook/adapter-react`'s `injectCss` for the contract. */
function injectCss(target: Element, opts?: MountOptions): void {
  const css = opts?.css;
  if (!css) return;
  const cssId = opts?.cssId ?? '';

  const root = target.getRootNode();
  if (root instanceof ShadowRoot) {
    if (cssId && root.querySelector(`style[data-markbook-css="${cssId}"]`)) return;
    const style = document.createElement('style');
    if (cssId) style.setAttribute('data-markbook-css', cssId);
    style.textContent = css;
    root.appendChild(style);
    return;
  }

  if (cssId && document.head.querySelector(`style[data-markbook-css="${cssId}"]`)) return;
  const style = document.createElement('style');
  if (cssId) style.setAttribute('data-markbook-css', cssId);
  style.textContent = css;
  document.head.appendChild(style);
}
