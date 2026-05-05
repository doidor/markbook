import { type ReactNode, type CSSProperties } from 'react';

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

const VARIANT: Record<ButtonVariant, CSSProperties> = {
  primary: { background: '#6c5ce7', color: 'white', border: '1px solid transparent' },
  secondary: { background: '#f1f1f5', color: '#1a1a1a', border: '1px solid #d6d6db' },
  ghost: { background: 'transparent', color: '#6c5ce7', border: '1px solid transparent' },
  danger: { background: '#e63946', color: 'white', border: '1px solid transparent' },
};

const SIZE: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '0.25rem 0.6rem', fontSize: '0.8rem' },
  md: { padding: '0.45rem 0.9rem', fontSize: '0.9rem' },
  lg: { padding: '0.65rem 1.2rem', fontSize: '1rem' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  children,
}: ButtonProps) {
  const style: CSSProperties = {
    ...VARIANT[variant],
    ...SIZE[size],
    borderRadius: 6,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    fontWeight: 500,
    fontFamily: 'inherit',
    width: fullWidth ? '100%' : 'auto',
    transition: 'opacity 0.15s, background 0.15s',
  };
  return (
    <button style={style} disabled={disabled || loading} onClick={onClick}>
      {loading ? '…' : children}
    </button>
  );
}
