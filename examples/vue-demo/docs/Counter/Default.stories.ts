import { defineComponent, h } from 'vue';
import { Counter } from '../../src/Counter.js';

export default defineComponent({
  name: 'CounterDefault',
  render: () => h(Counter),
});
