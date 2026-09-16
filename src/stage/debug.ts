/** Key/value panel toggled with D. Values are rendered as text; nothing here affects the show. */
export class DebugPanel {
  private readonly rows = new Map<string, HTMLElement>();

  constructor(private readonly root: HTMLElement) {}

  toggle(): void {
    this.root.hidden = !this.root.hidden;
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  set(data: Record<string, string | number | boolean>): void {
    if (this.root.hidden) return;
    for (const [key, value] of Object.entries(data)) {
      let row = this.rows.get(key);
      if (!row) {
        row = document.createElement('div');
        row.className = 'debug-row';
        const k = document.createElement('span');
        k.textContent = key;
        const v = document.createElement('span');
        v.className = 'debug-value';
        row.append(k, v);
        this.root.append(row);
        this.rows.set(key, row);
      }
      const valueEl = row.lastElementChild as HTMLElement;
      const text = typeof value === 'number' ? value.toFixed(2) : String(value);
      if (valueEl.textContent !== text) valueEl.textContent = text;
    }
  }
}
