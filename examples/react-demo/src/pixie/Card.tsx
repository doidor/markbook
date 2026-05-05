import { type ReactNode, type CSSProperties } from 'react';

/** Inner padding preset. */
export type CardPadding = 'sm' | 'md' | 'lg';

export interface CardProps {
  /** Title rendered as the card header. Optional. */
  title?: string;
  /** Inner padding preset. */
  padding?: CardPadding;
  /** Apply a soft drop shadow for higher elevation. */
  elevated?: boolean;
  /** Card body content. */
  children: ReactNode;
}

const PAD: Record<CardPadding, string> = {
  sm: '0.75rem',
  md: '1.25rem',
  lg: '1.75rem',
};

export function Card({ title, padding = 'md', elevated = false, children }: CardProps) {
  const style: CSSProperties = {
    background: 'white',
    border: '1px solid #e6e6eb',
    borderRadius: 8,
    padding: PAD[padding],
    boxShadow: elevated ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
    fontFamily: 'inherit',
    color: '#1a1a1a',
    maxWidth: 360,
  };
  return (
    <div style={style}>
      {title ? (
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
      ) : null}
      {children}
    </div>
  );
}
