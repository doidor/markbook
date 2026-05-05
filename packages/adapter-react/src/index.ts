import { createRoot, type Root } from 'react-dom/client';
import {
  createElement,
  isValidElement,
  type ComponentType,
  type ReactNode,
} from 'react';

const roots = new WeakMap<Element, Root>();

interface MountOptions {
  /**
   * Decorators applied outer-to-inner: `[A, B]` produces
   * `<A><B><Story /></B></A>`. Each must be a component that receives
   * `{ children }`.
   */
  decorators?: ComponentType<{ children: ReactNode }>[];
  isolation?: 'shadow';
}

export function mount(
  el: Element | null,
  story: unknown,
  opts?: MountOptions,
): void {
  if (!el) return;

  const target = resolveMountTarget(el, opts);

  let root = roots.get(target);
  if (!root) {
    root = createRoot(target);
    roots.set(target, root);
  }

  let element: ReactNode;
  if (typeof story === 'function') {
    element = createElement(story as ComponentType);
  } else if (isValidElement(story)) {
    element = story;
  } else {
    throw new Error(
      'Markbook: story export must be a function component or a React element',
    );
  }

  if (opts?.decorators && opts.decorators.length > 0) {
    for (let i = opts.decorators.length - 1; i >= 0; i--) {
      element = createElement(opts.decorators[i]!, null, element);
    }
  }

  root.render(element);
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
