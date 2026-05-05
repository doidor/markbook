import { createRoot, type Root } from 'react-dom/client';
import {
  createElement,
  isValidElement,
  type ComponentType,
  type ReactNode,
} from 'react';

const roots = new WeakMap<Element, Root>();

interface MountOptions {
  wrapper?: ComponentType<{ children: ReactNode }>;
}

export function mount(
  el: Element | null,
  story: unknown,
  opts?: MountOptions,
): void {
  if (!el) return;

  let root = roots.get(el);
  if (!root) {
    root = createRoot(el);
    roots.set(el, root);
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

  if (opts?.wrapper) {
    element = createElement(opts.wrapper, null, element);
  }

  root.render(element);
}
