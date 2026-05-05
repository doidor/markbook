import type { ReactNode } from 'react';
import './pixie.css';
import styles from './Button.module.css';

/** Visual style variant. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Available button sizes. */
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  /** Visual style variant. */
  variant?: ButtonVariant;
  /** Button size. */
  size?: ButtonSize;
  /** Disable the button — non-interactive and visually muted. */
  disabled?: boolean;
  /** Show a loading indicator instead of children. */
  loading?: boolean;
  /** Stretch the button to fill its container's width. */
  fullWidth?: boolean;
  /** Click handler. */
  onClick?: () => void;
  /** Button label. */
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  children,
}: ButtonProps) {
  const className = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : null,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={className} disabled={disabled || loading} onClick={onClick}>
      {loading ? '…' : children}
    </button>
  );
}
