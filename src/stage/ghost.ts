import { LM, clamp01, dist, elbowOf, lerpPoint, levelIndex, otherHand, shoulderOf, wristOf } from './types';
import type { Hand, Landmarks, Level, Point } from './types';
import type { FigureRenderer } from './draw';

interface Anchors {
  shoulder: Record<Hand, Point>;
  hip: Record<Hand, Point>;
  sw: number;
  /** +1 when the hand's side is towards +x in camera space. */
  dir: Record<Hand, number>;
}

interface Move {
  name: string;
  /** 0 = low energy, 1 = mid, 2 = high. */
  zone: 0 | 1 | 2;
  lines(a: Anchors, strumHand: Hand): Point[][];
}

const ANIMATE_MS = 400;
const HOLD_MS = 800;
const FADE_MS = 600;

/**
 * Suggests one possible next air-guitar move as a faint dashed line figure anchored to the
 * player's own shoulders and hips. It inspires; it never corrects or scores.
 */
export class GhostLine {
  private active: { move: Move; startMs: number; from: Point[][] } | null = null;
  private nextAt = 0;
  private lastName = '';

  constructor(private readonly renderer: FigureRenderer) {}

  reset(): void {
    this.active = null;
    this.nextAt = 0;
    this.lastName = '';
  }

  update(lm: Landmarks, level: Level, t: number, strumHand: Hand): void {
    const anchors = anchorsFrom(lm);
    if (!this.active) {
      if (t < this.nextAt) return;
      const zone = levelIndex(level) <= 1 ? 0 : levelIndex(level) === 2 ? 1 : 2;
      const candidates = MOVES.filter((m) => m.zone === zone && m.name !== this.lastName);
      const move = candidates[Math.floor(Math.random() * candidates.length)] ?? MOVES[0];
      const fret = otherHand(strumHand);
      this.active = {
        move,
        startMs: t,
        from: [armLine(lm, fret), armLine(lm, strumHand)],
      };
      this.lastName = move.name;
    }

    const age = t - this.active.startMs;
    if (age > ANIMATE_MS + HOLD_MS + FADE_MS) {
      this.active = null;
      this.nextAt = t + 2000 + Math.random() * 2000;
      return;
    }
    const progress = clamp01(age / ANIMATE_MS);
    const fade = age < ANIMATE_MS + HOLD_MS ? 1 : 1 - (age - ANIMATE_MS - HOLD_MS) / FADE_MS;
    const target = this.active.move.lines(anchors, strumHand);
    const width = Math.max(2, anchors.sw * this.renderer.pixelsPerUnit() * 0.08);
    target.forEach((line, i) => {
      const from = this.active?.from[i];
      const points = from && from.length === line.length ? line.map((p, j) => lerpPoint(from[j], p, progress)) : line;
      this.renderer.drawNormalised(points, { alpha: 0.35 * fade, dashed: true, width, color: '#c8ff00' });
    });
  }
}

function anchorsFrom(lm: Landmarks): Anchors {
  const left = lm[LM.leftShoulder];
  const right = lm[LM.rightShoulder];
  return {
    shoulder: { left, right },
    hip: { left: lm[LM.leftHip], right: lm[LM.rightHip] },
    sw: Math.max(0.05, dist(left, right)),
    dir: { left: Math.sign(left.x - right.x) || 1, right: Math.sign(right.x - left.x) || -1 },
  };
}

function armLine(lm: Landmarks, hand: Hand): Point[] {
  return [lm[shoulderOf(hand)], lm[elbowOf(hand)], lm[wristOf(hand)]].map((p) => ({ x: p.x, y: p.y }));
}

/** Offsets are in shoulder widths, x positive towards the hand's own side. */
function arm(a: Anchors, hand: Hand, elbow: [number, number], wrist: [number, number]): Point[] {
  const s = a.shoulder[hand];
  const d = a.dir[hand];
  return [
    s,
    { x: s.x + d * elbow[0] * a.sw, y: s.y + elbow[1] * a.sw },
    { x: s.x + d * wrist[0] * a.sw, y: s.y + wrist[1] * a.sw },
  ];
}

const MOVES: Move[] = [
  {
    name: 'power strum',
    zone: 0,
    lines: (a, strum) => [arm(a, otherHand(strum), [0.6, 0.15], [1.3, 0.35]), arm(a, strum, [0.3, 0.6], [-0.1, 1.0])],
  },
  {
    name: 'low stance',
    zone: 0,
    lines: (a, strum) => {
      const drop = 0.3 * a.sw;
      const down = (line: Point[]) => line.map((p) => ({ x: p.x, y: p.y + drop }));
      return [
        down(arm(a, otherHand(strum), [0.6, 0.2], [1.2, 0.5])),
        down(arm(a, strum, [0.3, 0.6], [-0.1, 1.0])),
        [a.hip.left, a.hip.right].map((p) => ({ x: p.x, y: p.y + drop })),
      ];
    },
  },
  {
    name: 'guitar lift',
    zone: 1,
    lines: (a, strum) => [arm(a, otherHand(strum), [0.5, -0.3], [0.9, -0.7]), arm(a, strum, [0.2, 0.3], [-0.2, 0.2])],
  },
  {
    name: 'side lean',
    zone: 1,
    lines: (a, strum) => {
      const fret = otherHand(strum);
      const shift = a.dir[fret] * 0.5 * a.sw;
      const ls = { x: a.shoulder.left.x + shift, y: a.shoulder.left.y + 0.1 * a.sw };
      const rs = { x: a.shoulder.right.x + shift, y: a.shoulder.right.y + 0.1 * a.sw };
      const shifted: Anchors = { ...a, shoulder: { left: ls, right: rs } };
      return [[ls, rs, a.hip.right, a.hip.left, ls], arm(shifted, fret, [0.6, -0.2], [1.2, -0.4])];
    },
  },
  {
    name: 'windmill',
    zone: 2,
    lines: (a, strum) => {
      const s = a.shoulder[strum];
      const arc: Point[] = [];
      for (let i = 0; i <= 12; i++) {
        const angle = -Math.PI / 2 + (i / 12) * Math.PI * (a.dir[strum] > 0 ? 1 : -1);
        arc.push({ x: s.x + Math.cos(angle) * 1.2 * a.sw, y: s.y + Math.sin(angle) * 1.2 * a.sw });
      }
      return [arm(a, strum, [0.2, -0.7], [0.3, -1.4]), arc];
    },
  },
  {
    name: 'overhead finish',
    zone: 2,
    lines: (a) => [arm(a, 'left', [0.5, -0.8], [0.6, -1.5]), arm(a, 'right', [0.5, -0.8], [0.6, -1.5])],
  },
];
