import { Button } from '../../src/pixie/Button.js';

export const Variants = () => (
  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="danger">Delete</Button>
  </div>
);

export const Sizes = () => (
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </div>
);

export const Loading = () => <Button loading>Saving</Button>;

export const Disabled = () => <Button disabled>Unavailable</Button>;

export const FullWidth = () => (
  <div style={{ width: 320 }}>
    <Button fullWidth>Full width</Button>
  </div>
);
