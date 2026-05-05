import { Button } from '../../../src/pixie/Button.js';

export default () => (
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </div>
);
