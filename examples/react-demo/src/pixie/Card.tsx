import type { ReactNode } from 'react';
import './pixie.css';
import styles from './Card.module.css';

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

const PAD_CLASS: Record<CardPadding, string> = {
  sm: styles.padSm,
  md: styles.padMd,
  lg: styles.padLg,
};

export function Card({ title, padding = 'md', elevated = false, children }: CardProps) {
  const className = [styles.card, PAD_CLASS[padding], elevated ? styles.elevated : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={className}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      {children}
    </div>
  );
}
