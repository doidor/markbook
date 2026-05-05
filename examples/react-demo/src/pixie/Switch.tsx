import { type ChangeEvent, useState } from 'react';
import './pixie.css';
import styles from './Switch.module.css';

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

  const wrapClass = [styles.wrap, disabled ? styles.disabled : null].filter(Boolean).join(' ');
  const barClass = [styles.bar, isOn ? styles.barOn : null].filter(Boolean).join(' ');
  const thumbClass = [styles.thumb, isOn ? styles.thumbOn : null].filter(Boolean).join(' ');

  return (
    <label className={wrapClass}>
      <span className={styles.track}>
        <input
          type="checkbox"
          className={styles.input}
          checked={isControlled ? !!checked : undefined}
          defaultChecked={!isControlled ? defaultChecked : undefined}
          disabled={disabled}
          onChange={handleChange}
        />
        <span aria-hidden className={barClass} />
        <span aria-hidden className={thumbClass} />
      </span>
      {label}
    </label>
  );
}
