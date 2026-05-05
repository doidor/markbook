import { Card } from '../../../src/pixie/Card.js';

export default () => (
  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
    <Card title="sm" padding="sm">
      Tight
    </Card>
    <Card title="md" padding="md">
      Default
    </Card>
    <Card title="lg" padding="lg">
      Roomy
    </Card>
  </div>
);
