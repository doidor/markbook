import { defineComponent, h } from 'vue';
import { Counter } from '../src/Counter.js';

export const Default = defineComponent({
  name: 'CounterDefault',
  render: () => h(Counter),
});

export const StartingAt10 = defineComponent({
  name: 'CounterAt10',
  render: () => h(Counter, { initial: 10 }),
});

export const StepOfFive = defineComponent({
  name: 'CounterStep5',
  render: () => h(Counter, { initial: 0, step: 5 }),
});
