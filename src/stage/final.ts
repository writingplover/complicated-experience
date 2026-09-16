import { FigureRenderer } from './draw';
import type { Hand, Landmarks, Level } from './types';

export interface FinalData {
  /** The camera image at the freeze moment, unmirrored as captured; null in demo mode. */
  cameraFrame: HTMLCanvasElement | null;
  /** Last landmarks seen during the performance; null draws no figure. */
  landmarks: Landmarks | null;
  hand: Hand;
  level: Level;
  sourceAspect: number;
  score: number;
  peakLevel: Level;
  /** Seconds into the performance when the peak level was reached. */
  peakAtSec: number;
}

const W = 1920;
const H = 1080;
/** The figure is drawn at 1/6 resolution and upscaled with hard edges, like on stage. */
const FINAL_PIXEL = 6;

/** Freeze-frame overlay: re-renders the hero pose at 1920×1080 and offers a PNG download. */
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
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1c0a14');
    bg.addColorStop(1, '#0b0b0d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, H * 0.55, 50, W / 2, H * 0.55, H * 0.7);
    glow.addColorStop(0, 'rgba(255, 0, 153, 0.35)');
    glow.addColorStop(1, 'rgba(255, 0, 153, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // The real photo: mirrored like the stage, cover-fitted, with a dark band for the text.
    if (data.cameraFrame) {
      const frame = data.cameraFrame;
      const scale = Math.max(W / frame.width, H / frame.height);
      const fw = frame.width * scale;
      const fh = frame.height * scale;
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(frame, (W - fw) / 2, (H - fh) / 2, fw, fh);
      ctx.restore();
      const band = ctx.createLinearGradient(0, 0, 0, H);
      band.addColorStop(0, 'rgba(11, 11, 13, 0.75)');
      band.addColorStop(0.3, 'rgba(11, 11, 13, 0)');
      band.addColorStop(0.72, 'rgba(11, 11, 13, 0)');
      band.addColorStop(1, 'rgba(11, 11, 13, 0.8)');
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, W, H);
    }

    // The tracked pose over the photo, faint; full strength when there is no photo (demo mode).
    if (data.landmarks) {
      const figure = document.createElement('canvas');
      const renderer = new FigureRenderer(figure, { fixed: { width: W / FINAL_PIXEL, height: H / FINAL_PIXEL } });
      renderer.setSourceAspect(data.sourceAspect);
      renderer.drawFigure(data.landmarks, data.hand, data.level);
      renderer.present();
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = data.cameraFrame ? 0.3 : 1;
      if (data.level === 'legendary' || data.level === 'roaring') ctx.filter = 'drop-shadow(0 0 18px #ff0099)';
      ctx.drawImage(figure, 0, 0, W, H);
      ctx.restore();
    }

    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ff66c4';
    ctx.font = '700 26px Silkscreen, ui-monospace, monospace';
    ctx.fillText('AIR STAGE  ·  COMPLICATED', 80, 70);
    ctx.fillStyle = '#f4f1ea';
    ctx.font = '700 84px Silkscreen, "Arial Black", Impact, sans-serif';
    ctx.fillText(title.toUpperCase(), 80, 110);
    ctx.font = '700 40px Silkscreen, ui-monospace, monospace';
    ctx.fillStyle = '#ff0099';
    ctx.fillText(`SCORE ${data.score}`, 80, H - 150);
    ctx.fillStyle = 'rgba(244, 241, 234, 0.6)';
    ctx.font = '400 22px Silkscreen, ui-monospace, monospace';
    ctx.fillText('PLAYED TO AVRIL LAVIGNE’S COMPLICATED. SAVED ON THIS MACHINE ONLY, NOTHING UPLOADED.', 80, H - 90);
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
