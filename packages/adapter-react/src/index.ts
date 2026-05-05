import { createRoot, type Root } from 'react-dom/client';
import { createElement, isValidElement, type ComponentType, type ReactNode } from 'react';

const roots = new WeakMap<Element, Root>();

export interface StoryParameters {
  /** Container layout preset. */
  layout?: 'centered' | 'fullscreen' | 'padded';
  /** Background colour for the story preview. */
  background?: string;
}

interface MountOptions {
  /**
   * Decorators applied outer-to-inner: `[A, B]` produces
   * `<A><B><Story /></B></A>`. Each must be a component that receives
   * `{ children }`.
   */
  decorators?: ComponentType<{ children: ReactNode }>[];
  isolation?: 'shadow';
  /** Initial / current props passed to the story render function. */
  args?: Record<string, unknown>;
  /** Per-story display parameters applied to the placeholder element. */
  parameters?: StoryParameters;
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

function applyParameters(el: Element, params: StoryParameters | undefined): void {
  if (!params) return;
  const host = el as HTMLElement;
  for (const cls of LAYOUT_CLASSES) host.classList.remove(cls);
  if (params.layout) host.classList.add(`markbook-story--${params.layout}`);
  if (params.background !== undefined) host.style.background = params.background;
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

export type { MountOptions };
export { setupControls } from './controls.js';
export type { ArgType } from './controls.js';
