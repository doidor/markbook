import { Counter } from '../../src/Counter.js';

/**
 * Interactive story: every key in `args` becomes a control below the preview.
 * Changing a control re-mounts the story with the new props — `@markbook/adapter-vue`
 * passes `args` to the root component as props, so `Counter` re-renders.
 */
export const args = {
  label: 'Count',
  initial: 0,
  step: 1,
};

/**
 * Optional explicit control types. If omitted, Markbook infers from the
 * runtime arg value (boolean → checkbox, number → number input, else text).
 */
export const argTypes = {
  label: { control: 'text' as const },
  initial: { control: 'number' as const },
  step: { control: 'number' as const },
};

export const parameters = {
  layout: 'centered' as const,
};

export default Counter;
