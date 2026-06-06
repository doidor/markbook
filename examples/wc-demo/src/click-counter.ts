class ClickCounter extends HTMLElement {
  private count = 0;
  private button: HTMLButtonElement | null = null;

  connectedCallback(): void {
    if (this.button) return;
    const accent = this.getAttribute('accent') ?? '#ff8c42';
    const button = document.createElement('button');
    button.style.cssText = [
      'padding: 0.5rem 1rem',
      'font-size: 0.95rem',
      `background: ${accent}`,
      'color: white',
      'border: none',
      'border-radius: 6px',
      'cursor: pointer',
      'font-family: inherit',
    ].join(';');
    button.addEventListener('click', () => {
      this.count++;
      this.update();
    });
    this.appendChild(button);
    this.button = button;
    this.update();
  }

  private update(): void {
    const label = this.getAttribute('label') ?? 'Clicks';
    if (this.button) this.button.textContent = `${label}: ${this.count}`;
  }
}

if (!customElements.get('click-counter')) {
  customElements.define('click-counter', ClickCounter);
}
