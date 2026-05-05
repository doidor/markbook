import { Card } from '../../../src/pixie/Card.js';

export default () => (
  <Card title="Elevated" elevated>
    <p style={{ margin: 0 }}>
      Cards with the <code>elevated</code> flag get a soft drop shadow for higher visual emphasis.
    </p>
  </Card>
);
