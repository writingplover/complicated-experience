import type { Signals } from './types';

export interface DeckActions {
  start(): void;
  end(): void;
  reset(): void;
  skip(): void;
  toggleSource(): void;
  toggleGhost(): void;
  again(): void;
}

export type PlayMode = 'stopped' | 'paused' | 'playing';

const BARS = 19;

/**
 * Compact Winamp-flavoured deck: LCD clock, a tiny spectrum, the title marquee, song progress
 * and transport buttons. Only what the stage needs; the skin is hot pink, the layout is ours.
 */
export class Deck {
  private readonly time: HTMLElement;
  private readonly playstate: HTMLElement;
  private readonly marquee: HTMLElement;
  private readonly seekFill: HTMLElement;
  private readonly lampCam: HTMLElement;
  private readonly lampDemo: HTMLElement;
  private readonly ghostButton: HTMLElement;
  private readonly spectrum: CanvasRenderingContext2D | null;
  private readonly bars = new Array<number>(BARS).fill(0);
  private readonly peaks = new Array<number>(BARS).fill(0);
  private targets = new Array<number>(BARS).fill(0);

  constructor(root: HTMLElement, actions: DeckActions) {
    this.time = pick(root, '#wa-time');
    this.playstate = pick(root, '#wa-playstate');
    this.marquee = pick(root, '#wa-marquee');
    this.seekFill = pick(root, '#wa-seek-fill');
    this.lampCam = pick(root, '#wa-lamp-cam');
    this.lampDemo = pick(root, '#wa-lamp-demo');
    this.ghostButton = pick(root, '#wa-btn-ghost');
    this.spectrum = pick<HTMLCanvasElement>(root, '#wa-spectrum').getContext('2d');

    root.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!button) return;
      switch (button.dataset.action) {
        case 'start':
          actions.start();
          break;
        case 'end':
          actions.end();
          break;
        case 'reset':
          actions.reset();
          break;
        case 'skip':
          actions.skip();
          break;
        case 'source':
          actions.toggleSource();
          break;
        case 'ghost':
          actions.toggleGhost();
          break;
        case 'again':
          actions.again();
          break;
      }
    });
  }

  setSong(seconds: number, duration: number, mode: PlayMode): void {
    this.time.textContent = mmss(seconds);
    this.playstate.textContent = mode === 'playing' ? '▶' : mode === 'paused' ? '❚❚' : '■';
    this.seekFill.style.width = duration > 0 ? `${Math.min(100, (seconds / duration) * 100)}%` : '0%';
  }

  setMarquee(text: string): void {
    if (this.marquee.textContent !== text) this.marquee.textContent = text;
  }

  setSource(kind: 'camera' | 'demo' | null): void {
    this.lampCam.classList.toggle('is-on', kind === 'camera');
    this.lampDemo.classList.toggle('is-on', kind === 'demo');
  }

  setGhost(enabled: boolean): void {
    this.ghostButton.classList.toggle('is-on', enabled);
  }

  /** Feed the spectrum. Pass null when idle so the bars settle to a faint flicker. */
  setSignals(signals: Signals | null, energy: number): void {
    const source = signals ? [signals.strum, signals.body, signals.timing, signals.scale, signals.variety] : [0, 0, 0, 0, 0];
    for (let i = 0; i < BARS; i++) {
      const group = Math.min(4, Math.floor(i / 4));
      const base = i >= 16 ? energy / 100 : source[group];
      this.targets[i] = Math.max(0.04, base * (0.75 + Math.random() * 0.4));
    }
  }

  /** Call every frame. */
  tick(): void {
    const ctx = this.spectrum;
    if (!ctx) return;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < BARS; i++) {
      const target = this.targets[i];
      this.bars[i] += (target - this.bars[i]) * (target > this.bars[i] ? 0.5 : 0.15);
      this.peaks[i] = Math.max(this.bars[i], this.peaks[i] - 0.02);
      const h = Math.max(1, Math.round(this.bars[i] * H));
      const x = i * 4;
      const gradient = ctx.createLinearGradient(0, H - h, 0, H);
      gradient.addColorStop(0, '#ff66c4');
      gradient.addColorStop(1, '#ff0099');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, H - h, 3, h);
      const peakY = H - Math.round(this.peaks[i] * H) - 1;
      ctx.fillStyle = '#ffd6ee';
      ctx.fillRect(x, Math.max(0, peakY), 3, 1);
    }
  }
}

function mmss(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

function pick<T extends HTMLElement = HTMLElement>(root: HTMLElement, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`deck is missing ${selector}`);
  return el;
}
