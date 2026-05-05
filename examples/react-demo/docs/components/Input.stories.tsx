import { Input } from '../../src/pixie/Input.js';

export const Default = () => <Input placeholder="Type here..." />;

export const WithLabelAndHint = () => (
  <Input
    label="Display name"
    placeholder="e.g. Tudor"
    hint="Visible to other users."
  />
);

export const ErrorState = () => (
  <Input
    label="Email"
    defaultValue="not-an-email"
    error="Enter a valid email address."
  />
);

export const Disabled = () => (
  <Input label="API key" defaultValue="sk-…" disabled />
);
