import { Avatar } from '../../../src/pixie/Avatar.js';

/**
 * Single multi-export stories file demonstrating the `:::stories` directive.
 *
 * `Initials` is a plain render function — the most common form.
 *
 * `WithImage` is a render function too.
 *
 * `Sizes` is a render function returning a row of variants.
 *
 * `Square` is a CSF v3 object — render plus metadata (`name` + `parameters`)
 *   exercises the entry generator's CSF resolution path.
 */
export const Initials = () => <Avatar name="Tudor Popa" />;

export const WithImage = () => <Avatar name="Markbook mascot" src="https://placecats.com/64/64" />;

export const Sizes = () => (
  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
    <Avatar name="Ada Lovelace" size="sm" />
    <Avatar name="Grace Hopper" size="md" />
    <Avatar name="Margaret Hamilton" size="lg" />
    <Avatar name="Katherine Johnson" size="xl" />
  </div>
);

export const Square = {
  name: 'Square shape',
  parameters: { layout: 'centered' as const },
  render: () => <Avatar name="Lin Manuel" shape="square" size="lg" />,
};
