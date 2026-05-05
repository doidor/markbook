import { Switch } from '../../src/pixie/Switch.js';

export const Off = () => <Switch label="Email notifications" />;
export const On = () => <Switch label="Email notifications" defaultChecked />;
export const Disabled = () => (
  <Switch label="Locked setting" disabled defaultChecked />
);
