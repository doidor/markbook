import { Input } from '../../../src/pixie/Input.js';

export default () => (
  <Input
    label="Email"
    defaultValue="not-an-email"
    error="Enter a valid email address."
  />
);
