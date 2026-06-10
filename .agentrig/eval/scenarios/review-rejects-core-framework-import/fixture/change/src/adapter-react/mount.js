// React adapter. Framework imports are EXPECTED here — adapters bridge core
// to a specific framework. See ../../RULES.md §2.

import { createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

export function mount(el, Component, props) {
  const root = createRoot(el);
  root.render(createElement(Component, props));
  return () => root.unmount();
}

export function useMountEffect(fn) {
  useEffect(fn, []);
}
