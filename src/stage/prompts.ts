export interface PromptElements {
  prompt: HTMLElement;
  countdown: HTMLElement;
  callout: HTMLElement;
  hint: HTMLElement;
  meterFill: HTMLElement;
}

/** Centre prompts, countdown digits, transient callouts, the key hint and the vertical meter. */
export class Prompts {
  private readonly title: HTMLElement;
  private readonly sub: HTMLElement;
  private readonly ring: HTMLElement;
  private calloutTimer: number | undefined;

  constructor(private readonly el: PromptElements) {
    this.title = pick(el.prompt, '.prompt-title');
    this.sub = pick(el.prompt, '.prompt-sub');
    this.ring = pick(el.prompt, '.prompt-ring');
  }

  setPrompt(title: string, sub = ''): void {
    this.title.textContent = title;
    this.sub.textContent = sub;
    this.el.prompt.hidden = title === '' && sub === '';
    this.setProgress(0);
  }

  /** 0..1 ring around the prompt while a calibration hold is running. */
  setProgress(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    this.ring.style.setProperty('--progress', String(clamped));
    this.ring.hidden = clamped <= 0;
  }

  /** The vertical excitement meter, 0..100. No labels, the height is the message. */
  setMeter(energy: number): void {
    this.el.meterFill.style.height = `${Math.max(0, Math.min(100, energy))}%`;
  }

  countdown(value: number | null): void {
    this.el.countdown.hidden = value === null;
    if (value === null) return;
    this.el.countdown.textContent = String(value);
    this.el.countdown.classList.remove('is-pop');
    void this.el.countdown.offsetWidth;
    this.el.countdown.classList.add('is-pop');
  }

  callout(text: string): void {
    this.el.callout.textContent = text;
    this.el.callout.classList.remove('is-visible');
    void this.el.callout.offsetWidth;
    this.el.callout.classList.add('is-visible');
    window.clearTimeout(this.calloutTimer);
    this.calloutTimer = window.setTimeout(() => this.el.callout.classList.remove('is-visible'), 1400);
  }

  setHint(text: string): void {
    this.el.hint.textContent = text;
  }
}

function pick(root: HTMLElement, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`prompt markup is missing ${selector}`);
  return el;
}
