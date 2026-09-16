import { LEVELS } from './types';
import type { Level } from './types';

export interface HudElements {
  hud: HTMLElement;
  prompt: HTMLElement;
  countdown: HTMLElement;
  callout: HTMLElement;
  hint: HTMLElement;
}

/** Energy pill and meter, centre prompts, countdown digits, transient callouts, key hints. */
export class Hud {
  private readonly energyEl: HTMLElement;
  private readonly levelEl: HTMLElement;
  private readonly fillEl: HTMLElement;
  private readonly ringEl: HTMLElement;
  private readonly promptTitle: HTMLElement;
  private readonly promptSub: HTMLElement;
  private readonly levelTicks: HTMLElement[];
  private calloutTimer: number | undefined;

  constructor(private readonly el: HudElements) {
    this.energyEl = pick(el.hud, '.hud-energy');
    this.levelEl = pick(el.hud, '.hud-level');
    this.fillEl = pick(el.hud, '.hud-meter-fill');
    this.levelTicks = LEVELS.map((level) => pick(el.hud, `.hud-levels [data-level="${level}"]`));
    this.promptTitle = pick(el.prompt, '.prompt-title');
    this.promptSub = pick(el.prompt, '.prompt-sub');
    this.ringEl = pick(el.prompt, '.prompt-ring');
  }

  setEnergy(energy: number, level: Level): void {
    this.energyEl.textContent = `ENERGY ${Math.round(energy)}`;
    this.levelEl.textContent = level.toUpperCase();
    this.fillEl.style.width = `${Math.round(energy)}%`;
    for (const tick of this.levelTicks) tick.classList.toggle('is-active', tick.dataset.level === level);
  }

  setPrompt(title: string, sub = ''): void {
    this.promptTitle.textContent = title;
    this.promptSub.textContent = sub;
    this.el.prompt.hidden = title === '' && sub === '';
    this.setProgress(0);
  }

  /** 0..1 ring around the prompt while a calibration hold is running. */
  setProgress(progress: number): void {
    this.ringEl.style.setProperty('--progress', String(Math.max(0, Math.min(1, progress))));
    this.ringEl.hidden = progress <= 0;
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
  if (!el) throw new Error(`HUD is missing ${selector}`);
  return el;
}
