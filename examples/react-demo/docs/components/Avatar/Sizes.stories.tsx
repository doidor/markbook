import { Avatar } from '../../../src/pixie/Avatar.js';

export default () => (
  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
    <Avatar name="Ada Lovelace" size="sm" />
    <Avatar name="Grace Hopper" size="md" />
    <Avatar name="Margaret Hamilton" size="lg" />
    <Avatar name="Katherine Johnson" size="xl" />
  </div>
);
