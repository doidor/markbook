import { type CSSProperties } from 'react';

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

const SIZE_PX: Record<AvatarSize, number> = { sm: 24, md: 32, lg: 48, xl: 64 };

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
  const px = SIZE_PX[size];
  const style: CSSProperties = {
    width: px,
    height: px,
    borderRadius: shape === 'circle' ? '50%' : 6,
    background: src ? '#eee' : colorFor(name),
    color: 'white',
    fontSize: px * 0.4,
    fontWeight: 600,
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    userSelect: 'none',
    flexShrink: 0,
  };
  return (
    <div role="img" style={style} aria-label={name} title={name}>
      {src ? (
        <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initialsOf(name)
      )}
    </div>
  );
}
