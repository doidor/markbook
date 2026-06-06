import '../../src/click-counter.js';

/**
 * Interactive story: every key in `args` becomes a control below the preview.
 * `@markbook/adapter-wc` calls the story function with the current `args`, so
 * editing a control re-renders the element with the new attributes.
 */
export const args = {
  label: 'Clicks',
  accent: '#ff8c42',
};

export const argTypes = {
  label: { control: 'text' as const },
  accent: {
    control: 'select' as const,
    options: ['#ff8c42', '#42b883', '#7c3aed', '#e23c3c'],
  },
};

export const parameters = {
  layout: 'centered' as const,
};

export default (a: typeof args = args): HTMLElement => {
  const el = document.createElement('click-counter');
  el.setAttribute('label', String(a.label));
  el.setAttribute('accent', String(a.accent));
  return el;
};
