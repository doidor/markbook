import { createApp, type App, type Component } from 'vue';

const apps = new WeakMap<Element, App>();

export function mount(el: Element | null, story: unknown): void {
  if (!el) return;

  const existing = apps.get(el);
  if (existing) existing.unmount();

  const app = createApp(story as Component);
  app.mount(el);
  apps.set(el, app);
}
