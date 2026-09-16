export interface Point {
  x: number;
  y: number;
}

export interface Landmark extends Point {
  z: number;
  visibility: number;
}

/** 33 MediaPipe pose landmarks, normalised 0..1 in unmirrored camera space. */
export type Landmarks = Landmark[];

export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

export type Hand = 'left' | 'right';

export const LEVELS = ['watching', 'nodding', 'moving', 'roaring', 'legendary'] as const;
export type Level = (typeof LEVELS)[number];
/** Energy floors per level. Legendary also needs the energy held for a while, see EnergyEngine. */
export const LEVEL_FLOOR: Record<Level, number> = {
  watching: 0,
  nodding: 22,
  moving: 45,
  roaring: 68,
  legendary: 90,
};

export interface PoseFrame {
  landmarks: Landmarks | null;
  /** performance.now() based, monotonic. */
  timeMs: number;
}

export interface PoseSource {
  readonly kind: 'camera' | 'demo';
  readonly info: string;
  start(): Promise<void>;
  stop(): void;
  onFrame(listener: (frame: PoseFrame) => void): () => void;
}

export interface Signals {
  strum: number;
  body: number;
  timing: number;
  scale: number;
  variety: number;
}

export interface Calibration {
  /** Shoulder width in normalised units; every distance is divided by it. */
  shoulderWidth: number;
  dominant: Hand;
  /** True when the strumming hand should still be guessed from movement. */
  autoDominant: boolean;
}

export const wristOf = (hand: Hand): number => (hand === 'left' ? LM.leftWrist : LM.rightWrist);
export const elbowOf = (hand: Hand): number => (hand === 'left' ? LM.leftElbow : LM.rightElbow);
export const shoulderOf = (hand: Hand): number => (hand === 'left' ? LM.leftShoulder : LM.rightShoulder);
export const otherHand = (hand: Hand): Hand => (hand === 'left' ? 'right' : 'left');
export const levelIndex = (level: Level): number => LEVELS.indexOf(level);

export function levelFor(energy: number): Level {
  let level: Level = 'watching';
  for (const candidate of LEVELS) if (energy >= LEVEL_FLOOR[candidate]) level = candidate;
  return level;
}

export function isPresent(lm: Landmarks | null): lm is Landmarks {
  if (!lm || lm.length < 29) return false;
  return [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip].every((i) => lm[i].visibility > 0.5);
}

export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpPoint = (a: Point, b: Point, t: number): Point => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
