import './style.css';
import { Calibrator, liveShoulderWidth } from './stage/calibration';
import { Crowd } from './stage/crowd';
import { createDemoPose } from './stage/demo';
import { FigureRenderer } from './stage/draw';
import { EnergyEngine } from './stage/energy';
import type { EnergyState } from './stage/energy';
import { FinalOverlay } from './stage/final';
import { GhostLine } from './stage/ghost';
import { createCameraPose } from './stage/pose';
import { prefersReducedMotion } from './stage/prefs';
import { Prompts } from './stage/prompts';
import { Song } from './stage/song';
import { StateMachine } from './stage/state';
import type { StageState } from './stage/state';
import { isPresent, otherHand } from './stage/types';
import type { Landmarks, Level, PoseFrame, PoseSource } from './stage/types';
import { Deck } from './stage/winamp';
import type { DeckActions, PlayMode } from './stage/winamp';

const BPM = 78;
const SONG_URL = '/local/complicated.mp3';
const TRACK_TITLE = 'Avril Lavigne - Complicated (4:13)';
const SONG_HINT = 'Drop the MP3 at public/local/complicated.mp3 for sound. Without it a run lasts 60 seconds.';

function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`index.html is missing ${selector}`);
  return el;
}

const stage = $('#stage');
const cameraEl = $<HTMLVideoElement>('#camera');
const reducedMotion = prefersReducedMotion();

const renderer = new FigureRenderer($<HTMLCanvasElement>('#figure'));
const prompts = new Prompts({
  prompt: $('#prompt'),
  countdown: $('#countdown'),
  callout: $('#callout'),
  hint: $('#hint'),
  meter: $('#meter'),
});
const crowd = new Crowd($('#crowd'), stage, $('#flash'), reducedMotion);
const energy = new EnergyEngine(BPM);
const song = new Song(SONG_URL, BPM);
const ghost = new GhostLine(renderer);
const calibrator = new Calibrator();
const machine = new StateMachine();

let source: PoseSource | null = null;
let unsubscribe: (() => void) | null = null;
let lastLandmarks: Landmarks | null = null;
let lastEnergy: EnergyState | null = null;
let presentSince: number | null = null;
let lastLevel: Level = 'watching';
let performStartedMs = 0;
let countdownTimers: number[] = [];

// ---------------------------------------------------------------------------------------------
// Actions shared by keys and the deck buttons

const actions: DeckActions = {
  start() {
    if (!source) {
      void useSource('camera');
    } else if (machine.state === 'idle') {
      machine.set('calibrate');
    } else if (machine.state === 'calibrate') {
      skipCalibration();
    } else if (machine.state === 'final') {
      machine.set('idle');
    }
  },
  skip() {
    if (machine.state === 'calibrate') skipCalibration();
    else if (machine.state === 'idle' && source) machine.set('calibrate');
  },
  end() {
    if (machine.state === 'perform') machine.set('final');
    else if (machine.state === 'countdown' || machine.state === 'calibrate') machine.set('idle');
  },
  reset() {
    if (machine.state === 'idle') enter('idle');
    else machine.set('idle');
  },
  toggleSource() {
    void useSource(source?.kind === 'demo' ? 'camera' : 'demo');
  },
  toggleGhost() {
    ghost.enabled = !ghost.enabled;
    deck.setGhost(ghost.enabled);
  },
  again() {
    if (machine.state !== 'final' && machine.state !== 'idle') return;
    if (!source) return;
    resetRun();
    machine.set('countdown');
  },
};

const deck = new Deck($('#winamp'), actions);
const final = new FinalOverlay($('#final'), () => actions.again());

// ---------------------------------------------------------------------------------------------
// Pose source

/** Grab the current camera image at native size. Null when no camera is running (demo mode). */
function captureCameraFrame(): HTMLCanvasElement | null {
  if (source?.kind !== 'camera' || cameraEl.videoWidth === 0 || cameraEl.readyState < 2) return null;
  const canvas = document.createElement('canvas');
  canvas.width = cameraEl.videoWidth;
  canvas.height = cameraEl.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(cameraEl, 0, 0);
  return canvas;
}

function sourceAspect(): number {
  if (source?.kind === 'camera' && cameraEl.videoWidth > 0) return cameraEl.videoWidth / cameraEl.videoHeight;
  return 16 / 9;
}

async function useSource(kind: PoseSource['kind']): Promise<void> {
  unsubscribe?.();
  source?.stop();
  cameraEl.hidden = kind === 'demo';
  source = kind === 'demo' ? createDemoPose(BPM) : createCameraPose(cameraEl);
  unsubscribe = source.onFrame(onFrame);
  deck.setSource(null);
  prompts.setHint(
    kind === 'demo'
      ? 'Demo mode · M camera · Space start · Esc end · G ghost · R again'
      : 'M demo · Space start · Esc end · H swap hand · G ghost · R again',
  );
  if (kind === 'camera') prompts.setPrompt('Starting camera', 'Loading the pose model. This takes a few seconds the first time.');
  try {
    await source.start();
    renderer.setSourceAspect(sourceAspect());
    deck.setSource(kind);
    if (machine.state === 'idle') enter('idle');
  } catch (err) {
    console.error('[stage] pose source failed', err);
    prompts.setPrompt('Camera unavailable', 'Allow the camera and reload, or press M for demo mode.');
  }
}

// ---------------------------------------------------------------------------------------------
// Per-frame update

function onFrame(frame: PoseFrame): void {
  const now = frame.timeMs;
  const lm = frame.landmarks;
  const present = isPresent(lm);
  if (present) lastLandmarks = lm;

  if (machine.state !== 'final') {
    renderer.clear();
    switch (machine.state) {
      case 'idle':
        if (present) {
          presentSince ??= now;
          renderer.drawFigure(lm, energy.hand, 'watching');
          if (now - presentSince > 1000) machine.set('calibrate');
        } else {
          presentSince = null;
          renderer.drawGuide();
        }
        break;
      case 'calibrate': {
        if (present) renderer.drawFigure(lm, energy.hand, 'watching');
        const calibration = calibrator.update(lm, now);
        prompts.setProgress(calibrator.progress(now));
        if (calibration) {
          energy.setCalibration(calibration);
          machine.set('countdown');
        }
        break;
      }
      case 'countdown':
        if (present) renderer.drawFigure(lm, energy.hand, 'watching');
        break;
      case 'perform': {
        energy.setTime(song.time(), song.duration);
        const state = energy.update(lm, now);
        lastEnergy = state;
        prompts.setMeter(state.energy);
        crowd.setLevel(state.level);
        if (song.beatTick()) crowd.beat();
        if (state.streakHit) prompts.callout('On the beat');
        if (state.level === 'legendary' && lastLevel !== 'legendary') prompts.callout('Crowd goes wild');
        lastLevel = state.level;
        if (present) {
          renderer.drawFigure(lm, energy.hand, state.level);
          ghost.update(lm, state.level, now, energy.hand);
        }
        break;
      }
    }
  }

  deck.setSignals(machine.state === 'perform' ? (lastEnergy?.signals ?? null) : null, lastEnergy?.energy ?? 0);
  deck.tick();
  deck.setSong(song.time(), song.duration, playMode());

}

function playMode(): PlayMode {
  if (machine.state === 'perform') return 'playing';
  if (machine.state === 'calibrate' || machine.state === 'countdown') return 'paused';
  return 'stopped';
}

// ---------------------------------------------------------------------------------------------
// States

function marqueeFor(state: StageState): string {
  switch (state) {
    case 'idle':
      return source ? 'Step in · press play' : 'Air Stage · press play';
    case 'calibrate':
      return 'Raise both hands';
    case 'countdown':
      return 'Get ready';
    case 'perform':
      return TRACK_TITLE;
    case 'final':
      return 'Hero pose · ↻ to perform again';
  }
}

function resetRun(): void {
  energy.reset();
  lastEnergy = null;
  ghost.reset();
  calibrator.reset();
  presentSince = null;
  lastLevel = 'watching';
  crowd.setLevel('watching');
  crowd.showStart();
  prompts.setMeter(0);
  prompts.countdown(null);
}

function enter(state: StageState): void {
  stage.dataset.state = state;
  if (state !== 'final') final.hide();
  deck.setMarquee(marqueeFor(state));
  switch (state) {
    case 'idle':
      resetRun();
      if (!source) {
        prompts.setPrompt('Air Stage', 'Press Space to turn on the camera, or M for demo mode.');
      } else {
        prompts.setPrompt('Step in', song.loaded ? 'Stand 2 to 3 metres from the camera, full body in frame.' : SONG_HINT);
      }
      break;
    case 'calibrate':
      prompts.setPrompt('Raise both hands', 'Hold for two seconds. Raise one hand alone to make it your strumming hand.');
      break;
    case 'countdown':
      prompts.setPrompt('');
      runCountdown();
      break;
    case 'perform':
      prompts.setPrompt('');
      prompts.countdown(null);
      performStartedMs = performance.now();
      void song.start();
      crowd.begin();
      break;
    case 'final': {
      prompts.setPrompt('');
      const stats = energy.stats();
      final.show({
        cameraFrame: captureCameraFrame(),
        landmarks: lastLandmarks,
        hand: energy.hand,
        level: lastEnergy?.level ?? 'watching',
        sourceAspect: sourceAspect(),
        score: Math.round(stats.meanEnergy * 10),
        peakLevel: stats.peakLevel,
        peakAtSec: Math.max(0, (stats.peakAtMs - performStartedMs) / 1000),
      });
      break;
    }
  }
}

machine.onChange((next, prev) => {
  if (prev === 'perform') song.stop();
  if (prev === 'countdown') clearCountdown();
  enter(next);
});

song.onEnded(() => {
  if (machine.state === 'perform') machine.set('final');
});

function skipCalibration(): void {
  const shoulderWidth = lastLandmarks ? liveShoulderWidth(lastLandmarks) : 0.15;
  energy.setCalibration({ shoulderWidth, dominant: 'right', autoDominant: true });
  machine.set('countdown');
}

function runCountdown(): void {
  clearCountdown();
  prompts.countdown(3);
  countdownTimers = [
    window.setTimeout(() => prompts.countdown(2), 1000),
    window.setTimeout(() => prompts.countdown(1), 2000),
    window.setTimeout(() => machine.set('perform'), 3000),
  ];
}

function clearCountdown(): void {
  for (const timer of countdownTimers) window.clearTimeout(timer);
  countdownTimers = [];
}

// ---------------------------------------------------------------------------------------------
// Keys

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  const key = event.code === 'Space' ? ' ' : event.key;
  switch (key) {
    case ' ':
      event.preventDefault();
      actions.start();
      break;
    case 'Escape':
      actions.end();
      break;
    case 'h':
    case 'H':
      energy.setDominant(otherHand(energy.hand));
      prompts.callout(`${energy.hand} hand strums`);
      break;
    case 'm':
    case 'M':
      actions.toggleSource();
      break;
    case 'g':
    case 'G':
      actions.toggleGhost();
      break;
    case 'r':
    case 'R':
      actions.again();
      break;
    case '[':
    case ']':
      song.beatOffset = Math.round((song.beatOffset + (key === '[' ? -0.05 : 0.05)) * 100) / 100;
      prompts.callout(`Beat ${song.beatOffset.toFixed(2)}s`);
      break;
  }
});

window.addEventListener('resize', () => renderer.resize());

// ---------------------------------------------------------------------------------------------
// Boot

async function boot(): Promise<void> {
  enter('idle');
  const params = new URLSearchParams(location.search);
  const loaded = song.load().then(() => {
    if (machine.state === 'idle') enter('idle');
  });
  if (params.has('demo')) await useSource('demo');
  await loaded;
}

void boot();
