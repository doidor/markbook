class ClickCounter extends HTMLElement {
  private count = 0;
  private button: HTMLButtonElement | null = null;

  connectedCallback(): void {
    if (this.button) return;
    const button = document.createElement('button');
    button.style.cssText = [
      'padding: 0.5rem 1rem',
      'font-size: 0.95rem',
      'background: #ff8c42',
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
    if (this.button) this.button.textContent = `Clicks: ${this.count}`;
  }
}

if (!customElements.get('click-counter')) {
  customElements.define('click-counter', ClickCounter);
}
