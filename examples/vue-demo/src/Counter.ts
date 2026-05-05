import { defineComponent, ref, h } from 'vue';

export const Counter = defineComponent({
  name: 'Counter',
  props: {
    initial: { type: Number, default: 0 },
    step: { type: Number, default: 1 },
  },
  setup(props) {
    const count = ref(props.initial);
    const increment = () => {
      count.value += props.step;
    };
    return () =>
      h(
        'button',
        {
          onClick: increment,
          style: {
            padding: '0.5rem 1rem',
            fontSize: '0.95rem',
            background: '#42b883',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          },
        },
        `Count: ${count.value}`,
      );
  },
});
