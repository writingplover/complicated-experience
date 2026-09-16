import { LM } from './types';
import type { Landmark, Landmarks, PoseFrame, PoseSource } from './types';

const CYCLE_SECONDS = 40;

/**
 * A synthetic air-guitarist whose intensity cycles 0 → 1 → 0 over 40 seconds, so every crowd
 * level shows up. Same interface as the camera source; used for testing and as a demo safety net.
 */
export function createDemoPose(bpm: number): PoseSource {
  const listeners = new Set<(frame: PoseFrame) => void>();
  let running = false;
  let startedAt = 0;

  function pose(t: number): Landmarks {
    const intensity = 0.5 - 0.5 * Math.cos((t / CYCLE_SECONDS) * Math.PI * 2);
    const beatHz = bpm / 60;
    const strumHz = intensity < 0.3 ? beatHz / 2 : intensity < 0.7 ? beatHz : beatHz * 2;
    const bounce = Math.sin(t * Math.PI * 2 * beatHz) * 0.02 * intensity;
    const sway = Math.sin(t * 0.7) * 0.04 * intensity;
    const sw = 0.16;
    const cx = 0.5 + sway;
    const shoulderY = 0.4 + bounce;
    const armsUp = intensity > 0.75 && Math.floor(t / 5) % 2 === 1 && t % 5 < 1.2;
    const bend = 0.04 * intensity;

    // Unmirrored camera space: the person's left side is on the image's right.
    const lShoulder = pt(cx + sw / 2, shoulderY);
    const rShoulder = pt(cx - sw / 2, shoulderY);
    const hipY = shoulderY + 0.3 - bend;
    const lHip = pt(cx + sw * 0.35, hipY);
    const rHip = pt(cx - sw * 0.35, hipY);
    const kneeY = hipY + 0.25 - bend;
    const lKnee = pt(cx + sw * 0.4, kneeY);
    const rKnee = pt(cx - sw * 0.4, kneeY);
    const lAnkle = pt(cx + sw * 0.45, kneeY + 0.25);
    const rAnkle = pt(cx - sw * 0.45, kneeY + 0.25);
    const nose = pt(cx + Math.sin(t * beatHz * Math.PI * 2) * 0.012 * intensity, shoulderY - 0.13 + bounce * 0.5);

    // Right hand strums near the waist, left hand frets out to the side.
    const strumSwing = Math.sin(t * Math.PI * 2 * strumHz) * (0.05 + 0.13 * intensity);
    const rWrist = armsUp ? pt(cx - sw * 0.6, shoulderY - 0.35) : pt(cx - sw * 0.1, shoulderY + 0.2 + strumSwing);
    const lWrist = armsUp
      ? pt(cx + sw * 0.6, shoulderY - 0.35)
      : pt(cx + sw * (0.9 + 0.5 * intensity), shoulderY + 0.08 - 0.15 * intensity);
    const rElbow = pt((rShoulder.x + rWrist.x) / 2 - 0.04, (rShoulder.y + rWrist.y) / 2 + 0.02);
    const lElbow = pt((lShoulder.x + lWrist.x) / 2, (lShoulder.y + lWrist.y) / 2 + 0.05);

    const lm: Landmarks = Array.from({ length: 33 }, () => ({ ...nose, visibility: 0.6 }));
    lm[LM.nose] = nose;
    lm[LM.leftShoulder] = lShoulder;
    lm[LM.rightShoulder] = rShoulder;
    lm[LM.leftElbow] = lElbow;
    lm[LM.rightElbow] = rElbow;
    lm[LM.leftWrist] = lWrist;
    lm[LM.rightWrist] = rWrist;
    lm[LM.leftHip] = lHip;
    lm[LM.rightHip] = rHip;
    lm[LM.leftKnee] = lKnee;
    lm[LM.rightKnee] = rKnee;
    lm[LM.leftAnkle] = lAnkle;
    lm[LM.rightAnkle] = rAnkle;
    return lm;
  }

  function loop(): void {
    if (!running) return;
    const now = performance.now();
    const frame: PoseFrame = { landmarks: pose((now - startedAt) / 1000), timeMs: now };
    for (const listener of listeners) listener(frame);
    requestAnimationFrame(loop);
  }

  return {
    kind: 'demo',
    info: 'demo performer (synthetic)',
    async start() {
      startedAt = performance.now();
      running = true;
      requestAnimationFrame(loop);
    },
    stop() {
      running = false;
    },
    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function pt(x: number, y: number): Landmark {
  return { x, y, z: 0, visibility: 0.99 };
}
