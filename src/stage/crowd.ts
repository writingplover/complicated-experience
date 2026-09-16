import { levelIndex } from './types';
import type { Level } from './types';

export const CROWD_CLIPS = ['bored', 'mid', 'hyped', 'excited'] as const;
export type CrowdClip = (typeof CROWD_CLIPS)[number];
export type ClipStatus = 'loading' | 'ready' | 'missing';

/** Hard cuts: exactly one clip visible per level. The excited clip is reserved for Legendary. */
const OPACITY: Record<Level, Record<CrowdClip, number>> = {
  watching: { bored: 1, mid: 0, hyped: 0, excited: 0 },
  nodding: { bored: 1, mid: 0, hyped: 0, excited: 0 },
  moving: { bored: 0, mid: 1, hyped: 0, excited: 0 },
  roaring: { bored: 0, mid: 0, hyped: 1, excited: 0 },
  legendary: { bored: 0, mid: 0, hyped: 0, excited: 1 },
};

/**
 * Four always-playing muted loops, hard-cut by level, plus beat-driven lights, shake and flashes.
 * Missing clips fall back to a gradient so the stage still runs.
 */
export class Crowd {
  readonly status: Record<CrowdClip, ClipStatus> = { bored: 'loading', mid: 'loading', hyped: 'loading', excited: 'loading' };
  private readonly videos = new Map<CrowdClip, HTMLVideoElement>();
  private level: Level = 'watching';
  private beatTimer: number | undefined;
  private shakeTimer: number | undefined;
  private flashTimer: number | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly stage: HTMLElement,
    private readonly flash: HTMLElement,
    private readonly reducedMotion: boolean,
  ) {
    for (const clip of CROWD_CLIPS) {
      const video = root.querySelector<HTMLVideoElement>(`video[data-crowd="${clip}"]`);
      if (!video) {
        this.status[clip] = 'missing';
        continue;
      }
      this.videos.set(clip, video);
      video.addEventListener('error', () => {
        this.status[clip] = 'missing';
        video.hidden = true;
        this.updateFallback();
      });
      video.addEventListener('canplay', () => {
        if (this.status[clip] !== 'missing') this.status[clip] = 'ready';
      });
    }
    this.setLevel('watching');
  }

  /** Browsers may block autoplay until a gesture; call this again from a key handler. */
  async play(): Promise<void> {
    for (const video of this.videos.values()) {
      try {
        await video.play();
      } catch {
        // autoplay blocked or clip missing; the fallback gradient covers it
      }
    }
  }

  setLevel(level: Level): void {
    this.level = level;
    this.stage.dataset.level = level;
    const opacity = OPACITY[level];
    for (const [clip, video] of this.videos) video.style.opacity = String(opacity[clip]);
  }

  /** Called once per beat while performing. */
  beat(): void {
    const index = levelIndex(this.level);
    if (index >= 2) this.pulse(this.root, 'is-beat', 150, 'beatTimer');
    if (this.reducedMotion) return;
    if (index >= 3) this.pulse(this.stage, 'is-shake', 320, 'shakeTimer');
    if (index >= 4) {
      this.flash.style.opacity = '0.75';
      window.clearTimeout(this.flashTimer);
      this.flashTimer = window.setTimeout(() => {
        this.flash.style.opacity = '0';
      }, 70);
    }
  }

  private pulse(el: HTMLElement, cls: string, ms: number, timer: 'beatTimer' | 'shakeTimer'): void {
    el.classList.remove(cls);
    // Force a reflow so re-adding the class restarts the CSS animation.
    void el.offsetWidth;
    el.classList.add(cls);
    window.clearTimeout(this[timer]);
    this[timer] = window.setTimeout(() => el.classList.remove(cls), ms);
  }

  private updateFallback(): void {
    const allMissing = CROWD_CLIPS.every((clip) => this.status[clip] === 'missing');
    this.root.classList.toggle('crowd-missing', allMissing);
  }
}
