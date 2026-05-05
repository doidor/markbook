import { createApp, type App, type Component } from 'vue';

const apps = new WeakMap<Element, App>();

interface MountOptions {
  isolation?: 'shadow';
}

export function mount(el: Element | null, story: unknown, opts?: MountOptions): void {
  if (!el) return;

  const target = resolveMountTarget(el, opts);

  const existing = apps.get(target);
  if (existing) existing.unmount();

  const app = createApp(story as Component);
  app.mount(target);
  apps.set(target, app);
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
