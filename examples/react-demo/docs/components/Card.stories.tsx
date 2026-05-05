import { Card } from '../../src/pixie/Card.js';
import { Button } from '../../src/pixie/Button.js';

export const Basic = () => (
  <Card title="Bookmark">
    <p style={{ margin: '0 0 0.75rem' }}>
      The full Markbook source lives at github.com/popatudor/markbook.
    </p>
    <Button>Open</Button>
  </Card>
);

export const Elevated = () => (
  <Card title="Elevated" elevated>
    <p style={{ margin: 0 }}>
      Cards with the <code>elevated</code> flag get a soft drop shadow for higher visual emphasis.
    </p>
  </Card>
);

export const PaddingSizes = () => (
  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
    <Card title="sm" padding="sm">Tight</Card>
    <Card title="md" padding="md">Default</Card>
    <Card title="lg" padding="lg">Roomy</Card>
  </div>
);
