import { LM, dist, otherHand, wristOf } from './types';
import type { Hand, Landmarks, Level, Point } from './types';

const INK = '#ffd6ee';
const OUTLINE = '#000000';
const GUITAR = '#ff0099';
/** Ghost line colours: bright while animating, dim while fading. Alpha is not used in pixel mode. */
export const GHOST_BRIGHT = '#9ccc00';
export const GHOST_DIM = '#557300';
const GUIDE = '#5a1a40';

/** Every rendered pixel snaps to one of these, so the figure reads as hand-placed pixel art. */
const PALETTE: [number, number, number][] = [
  [0x00, 0x00, 0x00],
  [0xff, 0xd6, 0xee],
  [0xff, 0x00, 0x99],
  [0x9c, 0xcc, 0x00],
  [0x55, 0x73, 0x00],
  [0x5a, 0x1a, 0x40],
];

export interface StrokeOptions {
  color?: string;
  alpha?: number;
  width?: number;
  dashed?: boolean;
}

/**
 * Draws the player as a stick figure with a guitar on a full-stage canvas, mirrored so the
 * player sees themselves as in a mirror. Landmarks map with the same "cover" fit as the camera.
 */
export interface RendererOptions {
  /** Offscreen canvas size when the canvas is not laid out by CSS (the final frame). */
  fixed?: { width: number; height: number };
  /** CSS pixels per canvas pixel. 1 = sharp; 4 = chunky pixel art. Ignored with `fixed`. */
  pixelSize?: number;
}

/**
 * Winamp-era pixel art: the canvas is a few times smaller than it is displayed, CSS upscales it
 * with `image-rendering: pixelated`, and `present()` snaps every pixel to the palette.
 */
export class FigureRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fixed: RendererOptions['fixed'];
  private readonly pixelSize: number;
  private sourceAspect = 16 / 9;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: RendererOptions = {},
  ) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2d canvas not available');
    this.ctx = ctx;
    this.fixed = options.fixed;
    this.pixelSize = Math.max(1, options.pixelSize ?? 1);
    this.resize();
  }

  setSourceAspect(aspect: number): void {
    if (Number.isFinite(aspect) && aspect > 0) this.sourceAspect = aspect;
  }

  resize(): void {
    if (this.fixed) {
      this.canvas.width = this.fixed.width;
      this.canvas.height = this.fixed.height;
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width / this.pixelSize));
    this.canvas.height = Math.max(1, Math.round(rect.height / this.pixelSize));
  }

  /** Snap every drawn pixel to the palette and to full opacity. Call once per frame after drawing. */
  present(): void {
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const image = ctx.getImageData(0, 0, W, H);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 110) {
        d[i + 3] = 0;
        continue;
      }
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < PALETTE.length; c++) {
        const [r, g, b] = PALETTE[c];
        const dist = (d[i] - r) ** 2 + (d[i + 1] - g) ** 2 + (d[i + 2] - b) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      d[i] = PALETTE[best][0];
      d[i + 1] = PALETTE[best][1];
      d[i + 2] = PALETTE[best][2];
      d[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Normalised camera point → canvas pixel, cover-fitted and mirrored. */
  toPoint(p: Point): Point {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const contentH = Math.max(H, W / this.sourceAspect);
    const contentW = contentH * this.sourceAspect;
    const offsetX = (W - contentW) / 2;
    const offsetY = (H - contentH) / 2;
    return { x: W - (offsetX + p.x * contentW), y: offsetY + p.y * contentH };
  }

  drawGuide(): void {
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = GUIDE;
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.55, W * 0.18, H * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawFigure(lm: Landmarks, dominant: Hand, _level: Level): void {
    const { ctx } = this;
    const P = (i: number): Point => this.toPoint(lm[i]);
    const ls = P(LM.leftShoulder);
    const rs = P(LM.rightShoulder);
    const lh = P(LM.leftHip);
    const rh = P(LM.rightHip);
    const nose = P(LM.nose);
    const sw = Math.max(10, dist(ls, rs));
    const limb = sw * 0.22;
    const edge = Math.max(1, sw * 0.07);
    const head = { x: nose.x, y: nose.y - sw * 0.05 };
    const headR = sw * 0.3;
    const limbs = [
      [lh, P(LM.leftKnee), P(LM.leftAnkle)],
      [rh, P(LM.rightKnee), P(LM.rightAnkle)],
      [ls, P(LM.leftElbow), P(LM.leftWrist)],
      [rs, P(LM.rightElbow), P(LM.rightWrist)],
    ];
    const torso = [ls, rs, rh, lh];

    // Guitar geometry: body at the strumming hand, neck towards the fretting hand.
    const strum = P(wristOf(dominant));
    const fret = P(wristOf(otherHand(dominant)));
    const dx = fret.x - strum.x;
    const dy = fret.y - strum.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const body = { x: strum.x + ux * sw * 0.25, y: strum.y + uy * sw * 0.25 };
    const neckEnd = { x: fret.x + ux * sw * 0.35, y: fret.y + uy * sw * 0.35 };
    const angle = Math.atan2(uy, ux);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Pass 2: black outlines, drawn fat so they peek out around the pink fills.
    ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = OUTLINE;
    ctx.lineWidth = limb + edge * 2;
    for (const line of limbs) this.polyline(line);
    ctx.lineWidth = edge * 2;
    this.polygon(torso, true, true);
    ctx.beginPath();
    ctx.arc(head.x, head.y, headR + edge, 0, Math.PI * 2);
    ctx.fill();

    // Pass 3: pale pink fills.
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = limb;
    for (const line of limbs) this.polyline(line);
    this.polygon(torso, true, false);
    ctx.beginPath();
    ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
    ctx.fill();

    // Pass 4: the guitar, hot pink with its own black outline, on top of the arms.
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = sw * 0.12 + edge * 2;
    this.polyline([body, neckEnd]);
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.ellipse(body.x, body.y, sw * 0.42 + edge, sw * 0.3 + edge, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = GUITAR;
    ctx.lineWidth = sw * 0.12;
    this.polyline([body, neckEnd]);
    ctx.fillStyle = GUITAR;
    ctx.beginPath();
    ctx.ellipse(body.x, body.y, sw * 0.42, sw * 0.3, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(body.x - ux * sw * 0.1, body.y - uy * sw * 0.1, sw * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Draw a polyline given in normalised camera space. Used by the ghost line. */
  drawNormalised(points: Point[], options: StrokeOptions = {}): void {
    if (points.length < 2) return;
    const { ctx } = this;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = options.alpha ?? 1;
    ctx.strokeStyle = options.color ?? INK;
    ctx.lineWidth = options.width ?? 4;
    if (options.dashed) ctx.setLineDash([10, 12]);
    this.polyline(points.map((p) => this.toPoint(p)));
    ctx.restore();
  }

  /** Pixel length of a normalised x-distance, for sizing ghost-line strokes. */
  pixelsPerUnit(): number {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const contentH = Math.max(H, W / this.sourceAspect);
    return contentH * this.sourceAspect;
  }

  private polygon(points: Point[], fill: boolean, stroke: boolean): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  private polyline(points: Point[]): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
}
