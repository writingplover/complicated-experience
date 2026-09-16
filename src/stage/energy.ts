import { LM, LEVEL_FLOOR, clamp01, dist, isPresent, levelFor, levelIndex, mid, shoulderOf, wristOf } from './types';
import type { Calibration, Hand, Landmark, Landmarks, Level, Signals } from './types';

export interface EnergyState {
  signals: Signals;
  raw: number;
  energy: number;
  level: Level;
  streak: number;
  /** True on the frame a 4-peak on-beat streak completes. */
  streakHit: boolean;
  present: boolean;
}

export interface PerformanceStats {
  meanEnergy: number;
  peakLevel: Level;
  /** Absolute performance.now() time the peak level was entered. */
  peakAtMs: number;
}

const WEIGHTS: Signals = { strum: 0.3, body: 0.25, timing: 0.2, scale: 0.15, variety: 0.1 };
const SIGNAL_KEYS = Object.keys(WEIGHTS) as (keyof Signals)[];
const RISE = 0.25;
const FALL = 0.03;
const DROP_MARGIN = 5;
const DROP_HOLD_MS = 1000;
const PEAK_HOLD_MS = 2000;
const AUTO_HAND_MS = 5000;
/** Raw energy is pushed through this curve; > 1 makes the top of the meter harder to reach. */
const ENERGY_GAMMA = 1.25;
/**
 * Legendary is adaptive: locked for the first 30 s, brutal right after, reachable by the last
 * chorus. After the lock, the floor and the hold time ease from START to END over the rest of
 * the song.
 */
const LEGENDARY_LOCK_SEC = 30;
const LEGENDARY_FLOOR_START = 97;
const LEGENDARY_FLOOR_END = 82;
const LEGENDARY_HOLD_START_MS = 3000;
const LEGENDARY_HOLD_END_MS = 800;

/**
 * Five movement signals → energy 0..100 → crowd level. Pure logic, no DOM.
 * All distances are in shoulder widths so distance to the camera does not matter.
 */
export class EnergyEngine {
  private readonly beatPeriod: number;
  private calibration: Calibration | null = null;
  private dominant: Hand = 'right';
  private autoDominant = true;
  private prev: { lm: Landmarks; t: number } | null = null;
  private signals: Signals = { strum: 0, body: 0, timing: 0, scale: 0, variety: 0 };
  private energy = 0;
  private level: Level = 'watching';
  private dropSince: number | null = null;
  private wristEma = 0;
  private speedHistory: number[] = [];
  private peaks: number[] = [];
  private streak = 0;
  private reachWindow: { t: number; v: number }[] = [];
  private poseWindow: { t: number; key: string }[] = [];
  private travel = { left: 0, right: 0 };
  private firstSeenAt: number | null = null;
  private energySum = 0;
  private energyCount = 0;
  private levelSince: number | null = null;
  private legendarySince: number | null = null;
  private elapsedSec = 0;
  private durationSec = 60;
  private peakLevel: Level = 'watching';
  private peakAt = 0;

  constructor(bpm: number) {
    this.beatPeriod = 60 / bpm;
  }

  get hand(): Hand {
    return this.dominant;
  }

  get handIsGuessed(): boolean {
    return this.autoDominant;
  }

  /** Seconds into the performance and its total length. Drives how hard Legendary is right now. */
  setTime(elapsedSec: number, durationSec: number): void {
    this.elapsedSec = Math.max(0, elapsedSec);
    this.durationSec = Math.max(1, durationSec);
  }

  /** True during the opening lock: no amount of energy reaches Legendary. */
  get legendaryLocked(): boolean {
    return this.elapsedSec < LEGENDARY_LOCK_SEC;
  }

  /** 0..1 progress through the unlocked part of the song, smoothstepped. */
  private get legendaryEase(): number {
    const span = Math.max(1, this.durationSec - LEGENDARY_LOCK_SEC);
    const p = clamp01((this.elapsedSec - LEGENDARY_LOCK_SEC) / span);
    return p * p * (3 - 2 * p);
  }

  get legendaryFloor(): number {
    if (this.legendaryLocked) return Number.POSITIVE_INFINITY;
    return LEGENDARY_FLOOR_START + (LEGENDARY_FLOOR_END - LEGENDARY_FLOOR_START) * this.legendaryEase;
  }

  get legendaryHoldMs(): number {
    return LEGENDARY_HOLD_START_MS + (LEGENDARY_HOLD_END_MS - LEGENDARY_HOLD_START_MS) * this.legendaryEase;
  }

  private floors(): Record<Level, number> {
    return { ...LEVEL_FLOOR, legendary: this.legendaryFloor };
  }

  setCalibration(calibration: Calibration): void {
    this.calibration = calibration;
    this.dominant = calibration.dominant;
    this.autoDominant = calibration.autoDominant;
  }

  setDominant(hand: Hand): void {
    this.dominant = hand;
    this.autoDominant = false;
  }

  reset(): void {
    this.prev = null;
    this.signals = { strum: 0, body: 0, timing: 0, scale: 0, variety: 0 };
    this.energy = 0;
    this.level = 'watching';
    this.dropSince = null;
    this.wristEma = 0;
    this.speedHistory = [];
    this.peaks = [];
    this.streak = 0;
    this.reachWindow = [];
    this.poseWindow = [];
    this.travel = { left: 0, right: 0 };
    this.firstSeenAt = null;
    this.energySum = 0;
    this.energyCount = 0;
    this.levelSince = null;
    this.legendarySince = null;
    this.elapsedSec = 0;
    this.peakLevel = 'watching';
    this.peakAt = 0;
  }

  update(lm: Landmarks | null, t: number): EnergyState {
    const present = isPresent(lm);
    const dtMs = this.prev ? Math.min(100, Math.max(8, t - this.prev.t)) : 33;
    const dt = dtMs / 1000;
    let streakHit = false;

    if (present) {
      const sw = this.calibration?.shoulderWidth ?? Math.max(0.05, dist(lm[LM.leftShoulder], lm[LM.rightShoulder]));
      this.firstSeenAt ??= t;
      if (this.prev) {
        const p = this.prev.lm;
        const speed = (i: number) => dist(lm[i], p[i]) / sw / dt;

        if (this.autoDominant) {
          this.travel.left += dist(lm[LM.leftWrist], p[LM.leftWrist]);
          this.travel.right += dist(lm[LM.rightWrist], p[LM.rightWrist]);
          if (t - this.firstSeenAt > AUTO_HAND_MS) {
            this.dominant = this.travel.left > this.travel.right ? 'left' : 'right';
            this.autoDominant = false;
          }
        }
        const wrist = wristOf(this.dominant);

        // Strum: dominant wrist speed, 0..4 shoulder widths per second.
        this.wristEma += (speed(wrist) - this.wristEma) * 0.5;
        this.ema('strum', clamp01(this.wristEma / 4), 0.3);

        // Body: torso centre, knees and head, 0..1.5 shoulder widths per second.
        const torsoNow = mid(mid(lm[LM.leftShoulder], lm[LM.rightShoulder]), mid(lm[LM.leftHip], lm[LM.rightHip]));
        const torsoPrev = mid(mid(p[LM.leftShoulder], p[LM.rightShoulder]), mid(p[LM.leftHip], p[LM.rightHip]));
        const torsoSpeed = dist(torsoNow, torsoPrev) / sw / dt;
        const bodySpeed = (torsoSpeed + speed(LM.leftKnee) + speed(LM.rightKnee) + speed(LM.nose)) / 4;
        this.ema('body', clamp01(bodySpeed / 1.5), 0.3);

        // Timing: regularity of wrist-speed peaks against the beat period, phase-free.
        this.speedHistory.push(this.wristEma);
        if (this.speedHistory.length > 3) this.speedHistory.shift();
        if (this.speedHistory.length === 3) {
          const [a, b, c] = this.speedHistory;
          const lastPeak = this.peaks[this.peaks.length - 1] ?? -Infinity;
          if (b > a && b >= c && b > 1 && t - lastPeak > 150) streakHit = this.onPeak(t);
        }
        this.ema('timing', this.timingScore(t), 0.2);

        // Scale: how far the strumming hand gets from its shoulder, rolling max over 1 s.
        const reach = dist(lm[wrist], lm[shoulderOf(this.dominant)]) / sw;
        this.reachWindow.push({ t, v: reach });
        while (this.reachWindow.length && t - this.reachWindow[0].t > 1000) this.reachWindow.shift();
        let maxReach = 0;
        for (const r of this.reachWindow) maxReach = Math.max(maxReach, r.v);
        this.ema('scale', clamp01((maxReach - 0.5) / 1.1), 0.3);

        // Variety: distinct coarse poses in the last 6 s.
        this.poseWindow.push({ t, key: poseKey(lm, sw) });
        while (this.poseWindow.length && t - this.poseWindow[0].t > 6000) this.poseWindow.shift();
        const distinct = new Set(this.poseWindow.map((e) => e.key)).size;
        this.ema('variety', clamp01(distinct / 8), 0.2);
      }
      this.prev = { lm, t };
    } else {
      this.prev = null;
      for (const key of SIGNAL_KEYS) this.ema(key, 0, 0.1);
    }

    let raw = 0;
    for (const key of SIGNAL_KEYS) raw += WEIGHTS[key] * this.signals[key];
    raw = 100 * Math.pow(clamp01(raw), ENERGY_GAMMA);
    if (streakHit) this.energy = Math.min(100, this.energy + 5);

    const alpha = raw > this.energy ? RISE : FALL;
    const k = 1 - Math.pow(1 - alpha, dtMs / 33);
    this.energy += (raw - this.energy) * k;

    this.updateLevel(t);

    this.energySum += this.energy;
    this.energyCount += 1;
    if (this.levelSince !== null && t - this.levelSince >= PEAK_HOLD_MS && levelIndex(this.level) > levelIndex(this.peakLevel)) {
      this.peakLevel = this.level;
      this.peakAt = this.levelSince;
    }

    return { signals: { ...this.signals }, raw, energy: this.energy, level: this.level, streak: this.streak, streakHit, present };
  }

  stats(): PerformanceStats {
    return {
      meanEnergy: this.energyCount ? this.energySum / this.energyCount : 0,
      peakLevel: this.peakLevel,
      peakAtMs: this.peakAt,
    };
  }

  private ema(key: keyof Signals, target: number, alpha: number): void {
    this.signals[key] += (target - this.signals[key]) * alpha;
  }

  private updateLevel(t: number): void {
    const floors = this.floors();
    let target = levelFor(this.energy, floors);
    if (target === 'legendary' && this.level !== 'legendary') {
      this.legendarySince ??= t;
      if (t - this.legendarySince < this.legendaryHoldMs) target = 'roaring';
    } else if (target !== 'legendary') {
      this.legendarySince = null;
    }
    if (levelIndex(target) > levelIndex(this.level)) {
      this.level = target;
      this.levelSince = t;
      this.dropSince = null;
    } else if (levelIndex(target) < levelIndex(this.level)) {
      if (this.energy < floors[this.level] - DROP_MARGIN) {
        this.dropSince ??= t;
        if (t - this.dropSince >= DROP_HOLD_MS) {
          this.level = target;
          this.levelSince = t;
          this.dropSince = null;
        }
      } else {
        this.dropSince = null;
      }
    } else {
      this.dropSince = null;
    }
  }

  private onPeak(t: number): boolean {
    this.peaks.push(t);
    if (this.peaks.length > 9) this.peaks.shift();
    const n = this.peaks.length;
    if (n < 2) return false;
    const interval = (this.peaks[n - 1] - this.peaks[n - 2]) / 1000;
    if (this.onBeat(interval)) {
      this.streak += 1;
      return this.streak > 0 && this.streak % 4 === 0;
    }
    this.streak = 0;
    return false;
  }

  private onBeat(intervalSec: number): boolean {
    return [0.25, 0.5, 1, 2].some((k) => Math.abs(intervalSec - k * this.beatPeriod) / (k * this.beatPeriod) < 0.15);
  }

  private timingScore(t: number): number {
    const last = this.peaks[this.peaks.length - 1];
    if (last === undefined || t - last > 1500) return 0;
    let onBeat = 0;
    let total = 0;
    for (let i = 1; i < this.peaks.length; i++) {
      total += 1;
      if (this.onBeat((this.peaks[i] - this.peaks[i - 1]) / 1000)) onBeat += 1;
    }
    return total ? onBeat / total : 0;
  }
}

/** Coarse pose descriptor: where each wrist is relative to the torso, plus lean direction. */
function poseKey(lm: Landmarks, sw: number): string {
  const shoulders = mid(lm[LM.leftShoulder], lm[LM.rightShoulder]);
  const hips = mid(lm[LM.leftHip], lm[LM.rightHip]);
  const cell = (w: Landmark): string => {
    const dx = (w.x - shoulders.x) / sw;
    const dy = (w.y - shoulders.y) / sw;
    return `${dx < -0.5 ? 'L' : dx > 0.5 ? 'R' : 'C'}${dy < -0.3 ? 'U' : dy > 1.2 ? 'D' : 'M'}`;
  };
  const lean = (shoulders.x - hips.x) / sw;
  return cell(lm[LM.leftWrist]) + cell(lm[LM.rightWrist]) + (lean > 0.2 ? 'R' : lean < -0.2 ? 'L' : 'C');
}
