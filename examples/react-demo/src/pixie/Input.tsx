import { type ChangeEvent, type CSSProperties } from 'react';

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
  const wrap: CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'column',
    gap: 4,
    fontFamily: 'inherit',
  };
  const labelStyle: CSSProperties = {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#1a1a1a',
  };
  const inputStyle: CSSProperties = {
    padding: '0.45rem 0.7rem',
    fontSize: '0.9rem',
    border: `1px solid ${error ? '#e63946' : '#d6d6db'}`,
    borderRadius: 6,
    fontFamily: 'inherit',
    color: '#1a1a1a',
    background: disabled ? '#f7f7f9' : 'white',
    minWidth: 240,
    outline: 'none',
  };
  const messageStyle: CSSProperties = {
    fontSize: '0.78rem',
    color: error ? '#e63946' : '#5b5b66',
  };
  return (
    <label style={wrap}>
      {label ? <span style={labelStyle}>{label}</span> : null}
      <input
        style={inputStyle}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        type={type}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
      />
      {error || hint ? <span style={messageStyle}>{error ?? hint}</span> : null}
    </label>
  );
}
