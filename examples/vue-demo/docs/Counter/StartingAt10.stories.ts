import { defineComponent, h } from 'vue';
import { Counter } from '../../src/Counter.js';

export default defineComponent({
  name: 'CounterAt10',
  render: () => h(Counter, { initial: 10 }),
});
