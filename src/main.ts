import './style.css';
import { Calibrator, liveShoulderWidth } from './stage/calibration';
import { Crowd } from './stage/crowd';
import { DebugPanel } from './stage/debug';
import { createDemoPose } from './stage/demo';
import { FigureRenderer } from './stage/draw';
import { EnergyEngine } from './stage/energy';
import type { EnergyState } from './stage/energy';
import { FinalOverlay } from './stage/final';
import { GhostLine } from './stage/ghost';
import { Hud } from './stage/hud';
import { createCameraPose } from './stage/pose';
import { prefersReducedMotion } from './stage/prefs';
import { Song } from './stage/song';
import { StateMachine } from './stage/state';
import { isPresent, otherHand } from './stage/types';
import type { StageState } from './stage/state';
import type { Landmarks, Level, PoseFrame, PoseSource } from './stage/types';

const BPM = 78;
const SONG_URL = '/local/complicated.mp3';
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
const hud = new Hud({ hud: $('#hud'), prompt: $('#prompt'), countdown: $('#countdown'), callout: $('#callout'), hint: $('#hint') });
const crowd = new Crowd($('#crowd'), stage, $('#flash'), reducedMotion);
const debug = new DebugPanel($('#debug'));
const energy = new EnergyEngine(BPM);
const song = new Song(SONG_URL, BPM);
const ghost = new GhostLine(renderer);
const calibrator = new Calibrator();
const machine = new StateMachine();
const final = new FinalOverlay($('#final'), () => machine.set('idle'));

let source: PoseSource | null = null;
let unsubscribe: (() => void) | null = null;
let lastLandmarks: Landmarks | null = null;
let presentSince: number | null = null;
let lastLevel: Level = 'watching';
let lastEnergy: EnergyState | null = null;
let performStartedMs = 0;
let countdownTimers: number[] = [];
let frameCount = 0;
let fpsWindowStart = performance.now();
let fps = 0;

// ---------------------------------------------------------------------------------------------
// Pose source

async function useSource(kind: PoseSource['kind']): Promise<void> {
  unsubscribe?.();
  source?.stop();
  cameraEl.hidden = kind === 'demo';
  source = kind === 'demo' ? createDemoPose(BPM) : createCameraPose(cameraEl);
  unsubscribe = source.onFrame(onFrame);
  hud.setHint(kind === 'demo' ? 'DEMO MODE · M camera · D debug · Space start · Esc end' : 'M demo · D debug · Space start · Esc end · H swap hand');
  if (kind === 'camera') hud.setPrompt('Starting camera', 'Loading the pose model. This takes a few seconds the first time.');
  try {
    await source.start();
    if (kind === 'camera') renderer.setSourceAspect(cameraEl.videoWidth / cameraEl.videoHeight);
    if (machine.state === 'idle') enter('idle');
  } catch (err) {
    console.error('[stage] pose source failed', err);
    hud.setPrompt('Camera unavailable', 'Allow the camera and reload, or press M for demo mode.');
  }
}

// ---------------------------------------------------------------------------------------------
// Per-frame update

function onFrame(frame: PoseFrame): void {
  const now = frame.timeMs;
  frameCount += 1;
  if (now - fpsWindowStart >= 1000) {
    fps = (frameCount * 1000) / (now - fpsWindowStart);
    frameCount = 0;
    fpsWindowStart = now;
  }
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
        hud.setProgress(calibrator.progress(now));
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
        const state = energy.update(lm, now);
        lastEnergy = state;
        hud.setEnergy(state.energy, state.level);
        crowd.setLevel(state.level);
        if (song.beatTick()) crowd.beat();
        if (state.streakHit) hud.callout('On the beat');
        if (state.level === 'legendary' && lastLevel !== 'legendary') hud.callout('Crowd goes wild');
        lastLevel = state.level;
        if (present) {
          renderer.drawFigure(lm, energy.hand, state.level);
          ghost.update(lm, state.level, now, energy.hand);
        }
        break;
      }
    }
  }

  if (debug.visible) {
    const e = lastEnergy;
    debug.set({
      source: source?.info ?? 'none',
      fps: fps.toFixed(0),
      state: machine.state,
      present,
      hand: `${energy.hand}${energy.handIsGuessed ? ' (guessing)' : ''}`,
      strum: e?.signals.strum ?? 0,
      body: e?.signals.body ?? 0,
      timing: e?.signals.timing ?? 0,
      scale: e?.signals.scale ?? 0,
      variety: e?.signals.variety ?? 0,
      raw: e?.raw ?? 0,
      energy: e?.energy ?? 0,
      level: e?.level ?? 'watching',
      streak: e?.streak ?? 0,
      song: song.loaded ? `${song.time().toFixed(1)}s / ${song.duration.toFixed(0)}s` : song.missingReason,
      'beat offset': `${song.beatOffset.toFixed(2)}s  ( [ ] )`,
      crowd: `${crowd.status.bored} / ${crowd.status.mid} / ${crowd.status.excited}`,
      motion: reducedMotion ? 'reduced' : 'full',
    });
  }
}

// ---------------------------------------------------------------------------------------------
// States

function enter(state: StageState): void {
  stage.dataset.state = state;
  switch (state) {
    case 'idle':
      final.hide();
      energy.reset();
      lastEnergy = null;
      ghost.reset();
      calibrator.reset();
      presentSince = null;
      lastLevel = 'watching';
      crowd.setLevel('watching');
      hud.setEnergy(0, 'watching');
      hud.countdown(null);
      if (!source) {
        hud.setPrompt('Air Stage', 'Press Space to turn on the camera, or M for demo mode.');
      } else {
        hud.setPrompt('Step in', song.loaded ? 'Stand 2 to 3 metres from the camera, full body in frame.' : SONG_HINT);
      }
      break;
    case 'calibrate':
      hud.setPrompt('Raise both hands', 'Hold for two seconds. Raise one hand alone to make it your strumming hand.');
      break;
    case 'countdown':
      hud.setPrompt('');
      runCountdown();
      break;
    case 'perform':
      hud.setPrompt('');
      hud.countdown(null);
      performStartedMs = performance.now();
      void song.start();
      void crowd.play();
      break;
    case 'final': {
      hud.setPrompt('');
      const stats = energy.stats();
      final.show({
        figure: renderer.snapshot(),
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

function runCountdown(): void {
  clearCountdown();
  hud.countdown(3);
  countdownTimers = [
    window.setTimeout(() => hud.countdown(2), 1000),
    window.setTimeout(() => hud.countdown(1), 2000),
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
      if (!source) {
        void useSource('camera');
      } else if (machine.state === 'idle') {
        machine.set('calibrate');
      } else if (machine.state === 'calibrate') {
        const shoulderWidth = lastLandmarks ? liveShoulderWidth(lastLandmarks) : 0.15;
        energy.setCalibration({ shoulderWidth, dominant: 'right', autoDominant: true });
        machine.set('countdown');
      } else if (machine.state === 'final') {
        machine.set('idle');
      }
      void crowd.play();
      break;
    case 'Escape':
      if (machine.state === 'perform') machine.set('final');
      else if (machine.state === 'countdown' || machine.state === 'calibrate') machine.set('idle');
      break;
    case 'd':
    case 'D':
      debug.toggle();
      break;
    case 'h':
    case 'H':
      energy.setDominant(otherHand(energy.hand));
      hud.callout(`${energy.hand} hand strums`);
      break;
    case 'm':
    case 'M':
      void useSource(source?.kind === 'demo' ? 'camera' : 'demo');
      break;
    case '[':
      song.beatOffset = Math.round((song.beatOffset - 0.05) * 100) / 100;
      break;
    case ']':
      song.beatOffset = Math.round((song.beatOffset + 0.05) * 100) / 100;
      break;
  }
});

window.addEventListener('resize', () => renderer.resize());

// ---------------------------------------------------------------------------------------------
// Boot

async function boot(): Promise<void> {
  enter('idle');
  const params = new URLSearchParams(location.search);
  if (params.has('debug')) debug.toggle();
  const loaded = song.load().then(() => {
    if (machine.state === 'idle') enter('idle');
  });
  if (params.has('demo')) await useSource('demo');
  await loaded;
}

void boot();
