import { type ChangeEvent, useState } from 'react';

export interface SwitchProps {
  /** Controlled checked state. */
  checked?: boolean;
  /** Uncontrolled initial checked state. */
  defaultChecked?: boolean;
  /** Disable the switch. */
  disabled?: boolean;
  /** Label rendered next to the switch. */
  label?: string;
  /** Change handler — receives the new checked state. */
  onChange?: (checked: boolean) => void;
}

export function Switch({
  checked,
  defaultChecked = false,
  disabled = false,
  label,
  onChange,
}: SwitchProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const isOn = isControlled ? !!checked : internal;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (!isControlled) setInternal(e.target.checked);
    onChange?.(e.target.checked);
  }

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        fontSize: '0.9rem',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span style={{ position: 'relative', display: 'inline-block', width: 32, height: 18 }}>
        <input
          type="checkbox"
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          checked={isControlled ? !!checked : undefined}
          defaultChecked={!isControlled ? defaultChecked : undefined}
          disabled={disabled}
          onChange={handleChange}
        />
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: isOn ? '#6c5ce7' : '#d6d6db',
            borderRadius: 9999,
            transition: 'background 0.15s',
          }}
        />
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 2,
            left: isOn ? 16 : 2,
            width: 14,
            height: 14,
            background: 'white',
            borderRadius: '50%',
            transition: 'left 0.15s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />
      </span>
      {label}
    </label>
  );
}
