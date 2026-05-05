import { Avatar } from '../../src/pixie/Avatar.js';

export const Initials = () => <Avatar name="Tudor Popa" />;

export const WithImage = () => (
  <Avatar name="Markbook mascot" src="https://placecats.com/64/64" />
);

export const Sizes = () => (
  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
    <Avatar name="Ada Lovelace" size="sm" />
    <Avatar name="Grace Hopper" size="md" />
    <Avatar name="Margaret Hamilton" size="lg" />
    <Avatar name="Katherine Johnson" size="xl" />
  </div>
);

export const Square = () => <Avatar name="Lin Manuel" shape="square" size="lg" />;
