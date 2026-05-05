import { Button } from '../../../src/pixie/Button.js';
import styles from './Sizes.module.css';

export default () => (
  <div className={styles.row}>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </div>
);
