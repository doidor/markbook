import { createRoot, type Root } from 'react-dom/client';
import { createElement, isValidElement, type ComponentType, type ReactNode } from 'react';
import {
  applyParameters,
  injectCss,
  resolveMountTarget,
  type BaseMountOptions,
} from '@doidor/markbook-adapter-shared';

const roots = new WeakMap<Element, Root>();

interface MountOptions extends BaseMountOptions {
  /**
   * Decorators applied outer-to-inner: `[A, B]` produces
   * `<A><B><Story /></B></A>`. Each must be a component that receives
   * `{ children }`.
   */
  decorators?: ComponentType<{ children: ReactNode }>[];
  /** Initial / current props passed to the story render function. */
  args?: Record<string, unknown>;
}

export function mount(el: Element | null, story: unknown, opts?: MountOptions): void {
  if (!el) return;

  applyParameters(el, opts?.parameters);
  const target = resolveMountTarget(el, opts?.isolation);
  injectCss(target, opts?.css, opts?.cssId);

  let root = roots.get(target);
  if (!root) {
    root = createRoot(target);
    roots.set(target, root);
  }

  let element: ReactNode;
  if (typeof story === 'function') {
    element = createElement(story as ComponentType, opts?.args ?? null);
  } else if (isValidElement(story)) {
    element = story;
  } else {
    throw new Error('Markbook: story export must be a function component or a React element');
  }

  if (opts?.decorators && opts.decorators.length > 0) {
    for (let i = opts.decorators.length - 1; i >= 0; i--) {
      element = createElement(opts.decorators[i]!, null, element);
    }
  }

  root.render(element);
}

export type { MountOptions };
export type { StoryParameters } from '@doidor/markbook-adapter-shared';
export { setupControls } from './controls.js';
export type { ArgType } from './controls.js';
