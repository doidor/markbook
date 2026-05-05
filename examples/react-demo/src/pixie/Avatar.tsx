import type { CSSProperties } from 'react';
import './pixie.css';
import styles from './Avatar.module.css';

/** Avatar size preset. */
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

/** Avatar shape — circle (default) or rounded square. */
export type AvatarShape = 'circle' | 'square';

export interface AvatarProps {
  /** Display name — used to derive initials when no image is provided. */
  name: string;
  /** Optional image URL. Falls back to initials if omitted. */
  src?: string;
  /** Size preset. */
  size?: AvatarSize;
  /** Shape — circle (default) or rounded square. */
  shape?: AvatarShape;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 50%, 55%)`;
}

export function Avatar({ name, src, size = 'md', shape = 'circle' }: AvatarProps) {
  const className = [styles.avatar, styles[size], styles[shape], src ? styles.imageHost : null]
    .filter(Boolean)
    .join(' ');
  const style: CSSProperties | undefined = src ? undefined : { background: colorFor(name) };
  return (
    <div role="img" className={className} style={style} aria-label={name} title={name}>
      {src ? <img src={src} alt={name} className={styles.image} /> : initialsOf(name)}
    </div>
  );
}
