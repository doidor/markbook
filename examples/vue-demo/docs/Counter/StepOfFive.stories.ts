import { defineComponent, h } from 'vue';
import { Counter } from '../../src/Counter.js';

export default defineComponent({
  name: 'CounterStep5',
  render: () => h(Counter, { initial: 0, step: 5 }),
});
