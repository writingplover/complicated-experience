import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmarks, PoseFrame, PoseSource } from './types';

/** Must equal the installed @mediapipe/tasks-vision version so WASM and JS match. */
const VERSION = '1.0.1';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

type Delegate = 'GPU' | 'CPU';

/** Camera-backed pose source. Asks for the camera in start(), so call it from a user gesture. */
export function createCameraPose(video: HTMLVideoElement): PoseSource {
  const listeners = new Set<(frame: PoseFrame) => void>();
  let landmarker: PoseLandmarker | undefined;
  let stream: MediaStream | undefined;
  let running = false;
  let delegate: Delegate = 'GPU';
  let lastVideoTime = -1;
  let lastTimestamp = 0;

  async function createLandmarker(chosen: Delegate): Promise<PoseLandmarker> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    return PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: chosen },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }

  function loop(): void {
    if (!running || !landmarker) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      let timestamp = performance.now();
      if (timestamp <= lastTimestamp) timestamp = lastTimestamp + 1;
      lastTimestamp = timestamp;
      let landmarks: Landmarks | null = null;
      try {
        const result = landmarker.detectForVideo(video, timestamp);
        const first = result.landmarks[0];
        if (first && first.length >= 29) {
          landmarks = first.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1 }));
        }
      } catch (err) {
        console.error('[pose] detect failed', err);
      }
      const frame: PoseFrame = { landmarks, timeMs: timestamp };
      for (const listener of listeners) listener(frame);
    }
    requestAnimationFrame(loop);
  }

  return {
    kind: 'camera',
    get info() {
      return `MediaPipe Pose lite · ${delegate}`;
    },
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      try {
        landmarker = await createLandmarker('GPU');
      } catch (err) {
        console.warn('[pose] GPU delegate failed, falling back to CPU', err);
        delegate = 'CPU';
        landmarker = await createLandmarker('CPU');
      }
      running = true;
      requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      landmarker?.close();
      landmarker = undefined;
      stream?.getTracks().forEach((track) => track.stop());
      stream = undefined;
      video.srcObject = null;
    },
    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
