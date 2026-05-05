/**
 * Per-arg control descriptor. If `argTypes` is omitted on the story,
 * controls are inferred from the runtime value: boolean → checkbox,
 * number → number input, anything else → text input.
 */
export interface ArgType {
  control?: 'text' | 'number' | 'boolean' | 'select';
  options?: ReadonlyArray<string | number>;
}

type ArgsRecord = Record<string, unknown>;

/**
 * Build DOM controls into `controlsEl` for each key of `args`, wire `input`
 * events to read the form back into `args` (mutating in place) and call
 * `onChange` so the caller can re-mount the story with the updated values.
 */
export function setupControls(
  controlsEl: Element,
  args: ArgsRecord,
  argTypes: Record<string, ArgType> | undefined,
  onChange: () => void,
): void {
  buildControls(controlsEl, args, argTypes);
  controlsEl.addEventListener('input', () => {
    readControls(controlsEl as HTMLElement, args);
    onChange();
  });
  controlsEl.addEventListener('change', () => {
    readControls(controlsEl as HTMLElement, args);
    onChange();
  });
}

function buildControls(
  el: Element,
  args: ArgsRecord,
  argTypes: Record<string, ArgType> | undefined,
): void {
  el.innerHTML = '';
  for (const [key, value] of Object.entries(args)) {
    const argType = argTypes?.[key];
    el.appendChild(createControlRow(key, value, argType));
  }
}

function createControlRow(key: string, value: unknown, argType: ArgType | undefined): HTMLElement {
  const row = document.createElement('div');
  row.className = 'markbook-control';

  const label = document.createElement('label');
  label.textContent = key;
  label.htmlFor = `markbook-ctrl-${key}`;
  row.appendChild(label);

  const input = createInput(key, value, argType);
  row.appendChild(input);

  return row;
}

function createInput(key: string, value: unknown, argType: ArgType | undefined): HTMLElement {
  const controlType = argType?.control ?? inferControlType(value);

  if (controlType === 'boolean') {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = `markbook-ctrl-${key}`;
    cb.dataset.argKey = key;
    cb.dataset.argControl = 'boolean';
    cb.checked = Boolean(value);
    return cb;
  }

  if (controlType === 'select') {
    const select = document.createElement('select');
    select.id = `markbook-ctrl-${key}`;
    select.dataset.argKey = key;
    select.dataset.argControl = 'select';
    const options = argType?.options ?? [];
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = String(opt);
      o.textContent = String(opt);
      if (opt === value) o.selected = true;
      select.appendChild(o);
    }
    return select;
  }

  if (controlType === 'number') {
    const input = document.createElement('input');
    input.type = 'number';
    input.id = `markbook-ctrl-${key}`;
    input.dataset.argKey = key;
    input.dataset.argControl = 'number';
    input.value = value === undefined || value === null ? '' : String(value);
    return input;
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.id = `markbook-ctrl-${key}`;
  input.dataset.argKey = key;
  input.dataset.argControl = 'text';
  input.value = value === undefined || value === null ? '' : String(value);
  return input;
}

function inferControlType(value: unknown): 'text' | 'number' | 'boolean' {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'text';
}

function readControls(el: HTMLElement, args: ArgsRecord): void {
  const inputs = el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-arg-key]');
  inputs.forEach((input) => {
    const key = input.dataset.argKey;
    if (!key) return;
    if (input instanceof HTMLInputElement && input.type === 'checkbox') {
      args[key] = input.checked;
    } else if (input instanceof HTMLInputElement && input.type === 'number') {
      const n = input.value === '' ? undefined : Number(input.value);
      args[key] = n;
    } else {
      args[key] = input.value;
    }
  });
}
