import '../../src/click-counter.js';

export default (): string => `
  <div style="display: flex; gap: 0.5rem; align-items: center;">
    <click-counter></click-counter>
    <click-counter></click-counter>
    <click-counter></click-counter>
  </div>
`;
