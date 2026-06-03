import { createApp, defineComponent, h, type App, type Component, type VNode } from 'vue';

const apps = new WeakMap<Element, App>();

export interface StoryParameters {
  layout?: 'centered' | 'fullscreen' | 'padded';
  background?: string;
}

interface MountOptions {
  /**
   * Decorators applied outer-to-inner: `[A, B]` produces
   * `<A><B><Story /></B></A>`. Each must be a Vue component with a default
   * slot.
   */
  decorators?: Component[];
  isolation?: 'shadow';
  /** Initial / current props passed to the story component as root props. */
  args?: Record<string, unknown>;
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

export function mount(el: Element | null, story: unknown, opts?: MountOptions): void {
  if (!el) return;

  applyParameters(el, opts?.parameters);
  const target = resolveMountTarget(el, opts);
  injectCss(target, opts);

  const existing = apps.get(target);
  if (existing) existing.unmount();

  const root =
    opts?.decorators && opts.decorators.length > 0
      ? wrapWithDecorators(story as Component, opts.decorators)
      : (story as Component);

  const app = opts?.args ? createApp(root, opts.args) : createApp(root);
  app.mount(target);
  apps.set(target, app);
}

function applyParameters(el: Element, params: StoryParameters | undefined): void {
  if (!params) return;
  const host = el as HTMLElement;
  for (const cls of LAYOUT_CLASSES) host.classList.remove(cls);
  if (params.layout) host.classList.add(`markbook-story--${params.layout}`);
  if (params.background !== undefined) host.style.background = params.background;
}

function wrapWithDecorators(story: Component, decorators: Component[]): Component {
  return defineComponent({
    name: 'MarkbookDecorated',
    setup() {
      return () => {
        let node: VNode = h(story);
        for (let i = decorators.length - 1; i >= 0; i--) {
          const Decorator = decorators[i]!;
          const child = node;
          node = h(Decorator, null, { default: () => child });
        }
        return node;
      };
    },
  });
}

function resolveMountTarget(el: Element, opts?: MountOptions): Element {
  if (opts?.isolation !== 'shadow') return el;
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
