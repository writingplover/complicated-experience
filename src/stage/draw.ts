import { LM, dist, otherHand, wristOf } from './types';
import type { Hand, Landmarks, Level, Point } from './types';

const INK = '#f4f1ea';
const GUITAR = '#2ee6a6';
const GLOW = '#ff2d95';

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
export class FigureRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private sourceAspect = 16 / 9;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas not available');
    this.ctx = ctx;
    this.resize();
  }

  setSourceAspect(aspect: number): void {
    if (Number.isFinite(aspect) && aspect > 0) this.sourceAspect = aspect;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
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
    ctx.setLineDash([12, 14]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(244, 241, 234, 0.35)';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.55, W * 0.12, H * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawFigure(lm: Landmarks, dominant: Hand, level: Level): void {
    const { ctx } = this;
    const P = (i: number): Point => this.toPoint(lm[i]);
    const ls = P(LM.leftShoulder);
    const rs = P(LM.rightShoulder);
    const lh = P(LM.leftHip);
    const rh = P(LM.rightHip);
    const nose = P(LM.nose);
    const sw = Math.max(24, dist(ls, rs));

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (level === 'legendary' || level === 'roaring') {
      ctx.shadowColor = level === 'legendary' ? GLOW : GUITAR;
      ctx.shadowBlur = level === 'legendary' ? sw * 0.6 : sw * 0.3;
    }

    // Limbs
    ctx.strokeStyle = INK;
    ctx.lineWidth = sw * 0.22;
    this.polyline([lh, P(LM.leftKnee), P(LM.leftAnkle)]);
    this.polyline([rh, P(LM.rightKnee), P(LM.rightAnkle)]);
    this.polyline([ls, P(LM.leftElbow), P(LM.leftWrist)]);
    this.polyline([rs, P(LM.rightElbow), P(LM.rightWrist)]);

    // Torso
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(ls.x, ls.y);
    ctx.lineTo(rs.x, rs.y);
    ctx.lineTo(rh.x, rh.y);
    ctx.lineTo(lh.x, lh.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(nose.x, nose.y - sw * 0.05, sw * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Guitar: body at the strumming hand, neck towards the fretting hand.
    const strum = P(wristOf(dominant));
    const fret = P(wristOf(otherHand(dominant)));
    const dx = fret.x - strum.x;
    const dy = fret.y - strum.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const body = { x: strum.x + ux * sw * 0.25, y: strum.y + uy * sw * 0.25 };
    const neckEnd = { x: fret.x + ux * sw * 0.35, y: fret.y + uy * sw * 0.35 };

    ctx.shadowBlur = 0;
    ctx.strokeStyle = GUITAR;
    ctx.lineWidth = sw * 0.12;
    this.polyline([body, neckEnd]);
    ctx.fillStyle = GUITAR;
    ctx.beginPath();
    ctx.ellipse(body.x, body.y, sw * 0.42, sw * 0.3, Math.atan2(uy, ux), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b0b0d';
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

  snapshot(): HTMLCanvasElement {
    const copy = document.createElement('canvas');
    copy.width = this.canvas.width;
    copy.height = this.canvas.height;
    copy.getContext('2d')?.drawImage(this.canvas, 0, 0);
    return copy;
  }

  private polyline(points: Point[]): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
}
