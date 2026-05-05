import type { ChangeEvent } from 'react';
import './pixie.css';
import styles from './Input.module.css';

/** HTML input type. */
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';

export interface InputProps {
  /** Controlled value. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  /** Placeholder shown when the input is empty. */
  placeholder?: string;
  /** Label rendered above the input. */
  label?: string;
  /** Helpful hint shown below the input. */
  hint?: string;
  /** Error message shown below the input — replaces the hint and applies error styling. */
  error?: string;
  /** Disable the input. */
  disabled?: boolean;
  /** HTML input type. */
  type?: InputType;
  /** Change handler — receives the new value. */
  onChange?: (value: string) => void;
}

export function Input({
  value,
  defaultValue,
  placeholder,
  label,
  hint,
  error,
  disabled = false,
  type = 'text',
  onChange,
}: InputProps) {
  const inputClass = [styles.input, error ? styles.error : null].filter(Boolean).join(' ');
  const messageClass = [styles.message, error ? styles.error : null].filter(Boolean).join(' ');
  return (
    <label className={styles.wrap}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <input
        className={inputClass}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        type={type}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
      />
      {error || hint ? <span className={messageClass}>{error ?? hint}</span> : null}
    </label>
  );
}
