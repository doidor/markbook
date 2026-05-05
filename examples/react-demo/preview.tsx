import { type ReactNode } from 'react';

/**
 * v0.6 decorator demo: wraps every story in a div carrying a
 * `data-markbook-decorator` attribute. No visual change, but the
 * presence of the attribute on every rendered story proves the
 * decorator API ran.
 *
 * Stack additional decorators by listing more paths in
 * `reactAdapter({ decorators: [...] })`. They are applied
 * outer-to-inner.
 */
export default function Preview({ children }: { children: ReactNode }) {
  return <div data-markbook-decorator="preview">{children}</div>;
}
