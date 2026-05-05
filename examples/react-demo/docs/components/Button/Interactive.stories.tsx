import { Button, type ButtonProps } from '../../../src/pixie/Button.js';

/**
 * Interactive story: every prop in `args` becomes a control below the
 * preview. Changing a control re-mounts the story with the new props.
 */
export const args: ButtonProps & { children: string } = {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  fullWidth: false,
  children: 'Click me',
};

/**
 * Optional explicit control types. If omitted, Markbook infers from the
 * runtime arg value (boolean → checkbox, number → number input, else text).
 */
export const argTypes = {
  variant: {
    control: 'select' as const,
    options: ['primary', 'secondary', 'ghost', 'danger'],
  },
  size: { control: 'select' as const, options: ['sm', 'md', 'lg'] },
  disabled: { control: 'boolean' as const },
  loading: { control: 'boolean' as const },
  fullWidth: { control: 'boolean' as const },
  children: { control: 'text' as const },
};

export const parameters = {
  layout: 'centered' as const,
};

export default function Interactive(props: typeof args) {
  return <Button {...props} />;
}
