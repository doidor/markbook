import '../src/click-counter.js';

export const Default = (): string => '<click-counter></click-counter>';

export const Multiple = (): string => `
  <div style="display: flex; gap: 0.5rem; align-items: center;">
    <click-counter></click-counter>
    <click-counter></click-counter>
    <click-counter></click-counter>
  </div>
`;
