import { Button } from '../../../src/pixie/Button.js';
import styles from './Variants.module.css';

export default () => (
  <div className={styles.row}>
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="danger">Delete</Button>
  </div>
);
