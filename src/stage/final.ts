import type { Level } from './types';

export interface FinalData {
  figure: HTMLCanvasElement;
  score: number;
  peakLevel: Level;
  /** Seconds into the performance when the peak level was reached. */
  peakAtSec: number;
}

/** Freeze-frame overlay: composes a 1920×1080 PNG of the hero pose and offers a download. */
export class FinalOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly download: HTMLButtonElement;
  private readonly titleEl: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private objectUrl: string | null = null;

  constructor(
    private readonly root: HTMLElement,
    onRestart: () => void,
  ) {
    this.canvas = pick<HTMLCanvasElement>(root, '.final-canvas');
    this.download = pick<HTMLButtonElement>(root, '.final-download');
    this.titleEl = pick(root, '.final-title');
    this.scoreEl = pick(root, '.final-score');
    pick<HTMLButtonElement>(root, '.final-again').addEventListener('click', onRestart);
    this.download.addEventListener('click', () => this.save());
  }

  show(data: FinalData): void {
    const title = titleFor(data.peakLevel, data.peakAtSec);
    this.titleEl.textContent = title;
    this.scoreEl.textContent = `${data.score} · peak ${data.peakLevel.toUpperCase()}`;
    this.compose(data, title);
    this.root.hidden = false;
    this.download.focus();
  }

  hide(): void {
    this.root.hidden = true;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }

  private compose(data: FinalData, title: string): void {
    const W = 1920;
    const H = 1080;
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#12101c');
    bg.addColorStop(1, '#0b0b0d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, H * 0.55, 50, W / 2, H * 0.55, H * 0.7);
    glow.addColorStop(0, 'rgba(255, 45, 149, 0.35)');
    glow.addColorStop(1, 'rgba(255, 45, 149, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // The frozen figure, scaled to fit the frame while keeping its aspect ratio.
    const scale = Math.min(W / data.figure.width, H / data.figure.height);
    const fw = data.figure.width * scale;
    const fh = data.figure.height * scale;
    ctx.drawImage(data.figure, (W - fw) / 2, (H - fh) / 2, fw, fh);

    ctx.textBaseline = 'top';
    ctx.fillStyle = '#c8ff00';
    ctx.font = '600 28px system-ui, sans-serif';
    ctx.fillText('AIR STAGE  ·  COMPLICATED', 80, 70);
    ctx.fillStyle = '#f4f1ea';
    ctx.font = '900 96px "Arial Black", Impact, sans-serif';
    ctx.fillText(title.toUpperCase(), 80, 110);
    ctx.font = '600 40px system-ui, sans-serif';
    ctx.fillStyle = '#ff2d95';
    ctx.fillText(`SCORE ${data.score}`, 80, H - 150);
    ctx.fillStyle = 'rgba(244, 241, 234, 0.6)';
    ctx.font = '400 26px system-ui, sans-serif';
    ctx.fillText('Played to Avril Lavigne’s Complicated. Nothing was recorded.', 80, H - 90);
  }

  private save(): void {
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = this.objectUrl;
      a.download = `air-stage-${Date.now()}.png`;
      a.click();
    }, 'image/png');
  }
}

function titleFor(level: Level, atSec: number): string {
  if (level === 'watching') return 'Warming up';
  const m = Math.floor(atSec / 60);
  const s = String(Math.floor(atSec % 60)).padStart(2, '0');
  return `${level[0].toUpperCase()}${level.slice(1)} at ${m}:${s}`;
}

function pick<T extends HTMLElement = HTMLElement>(root: HTMLElement, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`final overlay is missing ${selector}`);
  return el;
}
