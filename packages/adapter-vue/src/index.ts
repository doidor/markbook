import { createApp, defineComponent, h, type App, type Component, type VNode } from 'vue';
import {
  applyParameters,
  injectCss,
  resolveMountTarget,
  type BaseMountOptions,
} from '@markbook/adapter-shared';

const apps = new WeakMap<Element, App>();

interface MountOptions extends BaseMountOptions {
  /**
   * Decorators applied outer-to-inner: `[A, B]` produces
   * `<A><B><Story /></B></A>`. Each must be a Vue component with a default
   * slot.
   */
  decorators?: Component[];
  /** Initial / current props passed to the story component as root props. */
  args?: Record<string, unknown>;
}

export function mount(el: Element | null, story: unknown, opts?: MountOptions): void {
  if (!el) return;

  applyParameters(el, opts?.parameters);
  const target = resolveMountTarget(el, opts?.isolation);
  injectCss(target, opts?.css, opts?.cssId);

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

export type { StoryParameters } from '@markbook/adapter-shared';
