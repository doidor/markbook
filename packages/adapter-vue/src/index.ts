import { createApp, defineComponent, h, type App, type Component, type VNode } from 'vue';

const apps = new WeakMap<Element, App>();

interface MountOptions {
  /**
   * Decorators applied outer-to-inner: `[A, B]` produces
   * `<A><B><Story /></B></A>`. Each must be a Vue component with a default
   * slot.
   */
  decorators?: Component[];
  isolation?: 'shadow';
}

export function mount(el: Element | null, story: unknown, opts?: MountOptions): void {
  if (!el) return;

  const target = resolveMountTarget(el, opts);

  const existing = apps.get(target);
  if (existing) existing.unmount();

  const root =
    opts?.decorators && opts.decorators.length > 0
      ? wrapWithDecorators(story as Component, opts.decorators)
      : (story as Component);

  const app = createApp(root);
  app.mount(target);
  apps.set(target, app);
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
