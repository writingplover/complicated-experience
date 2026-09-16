import { LM, dist, isPresent } from './types';
import type { Calibration, Landmarks } from './types';

const BOTH_HANDS_MS = 1500;
const ONE_HAND_MS = 1000;

export function liveShoulderWidth(lm: Landmarks): number {
  return Math.max(0.05, dist(lm[LM.leftShoulder], lm[LM.rightShoulder]));
}

export function handsAboveHead(lm: Landmarks): { left: boolean; right: boolean } {
  const head = lm[LM.nose].y;
  const up = (i: number) => lm[i].visibility > 0.5 && lm[i].y < head;
  return { left: up(LM.leftWrist), right: up(LM.rightWrist) };
}

/**
 * Both hands up for 1.5 s: calibrated, strumming hand guessed later from movement.
 * One hand up alone for 1 s: calibrated, that hand strums.
 */
export class Calibrator {
  private bothSince: number | null = null;
  private leftSince: number | null = null;
  private rightSince: number | null = null;
  private widths: number[] = [];

  update(lm: Landmarks | null, t: number): Calibration | null {
    if (!isPresent(lm)) {
      this.reset();
      return null;
    }
    this.widths.push(liveShoulderWidth(lm));
    if (this.widths.length > 60) this.widths.shift();

    const { left, right } = handsAboveHead(lm);
    if (left && right) {
      this.leftSince = this.rightSince = null;
      this.bothSince ??= t;
      if (t - this.bothSince >= BOTH_HANDS_MS) return this.finish('right', true);
    } else if (left) {
      this.bothSince = this.rightSince = null;
      this.leftSince ??= t;
      if (t - this.leftSince >= ONE_HAND_MS) return this.finish('left', false);
    } else if (right) {
      this.bothSince = this.leftSince = null;
      this.rightSince ??= t;
      if (t - this.rightSince >= ONE_HAND_MS) return this.finish('right', false);
    } else {
      this.bothSince = this.leftSince = this.rightSince = null;
    }
    return null;
  }

  /** 0..1 progress of whichever hold is running, for the prompt ring. */
  progress(t: number): number {
    if (this.bothSince !== null) return Math.min(1, (t - this.bothSince) / BOTH_HANDS_MS);
    const single = this.leftSince ?? this.rightSince;
    if (single !== null) return Math.min(1, (t - single) / ONE_HAND_MS);
    return 0;
  }

  reset(): void {
    this.bothSince = this.leftSince = this.rightSince = null;
    this.widths = [];
  }

  private finish(dominant: Calibration['dominant'], autoDominant: boolean): Calibration {
    const sorted = [...this.widths].sort((a, b) => a - b);
    const shoulderWidth = sorted[Math.floor(sorted.length / 2)] ?? 0.15;
    this.reset();
    return { shoulderWidth, dominant, autoDominant };
  }
}
