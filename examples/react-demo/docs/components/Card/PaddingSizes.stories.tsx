import { Card } from '../../../src/pixie/Card.js';
import styles from './PaddingSizes.module.css';

export default () => (
  <div className={styles.row}>
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
