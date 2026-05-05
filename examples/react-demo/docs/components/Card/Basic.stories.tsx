import { Card } from '../../../src/pixie/Card.js';
import { Button } from '../../../src/pixie/Button.js';

export default () => (
  <Card title="Bookmark">
    <p style={{ margin: '0 0 0.75rem' }}>
      The full Markbook source lives at github.com/popatudor/markbook.
    </p>
    <Button>Open</Button>
  </Card>
);
