/**
 * The one place the song lives: the official video, embedded through the YouTube IFrame API.
 * We do not ship the recording itself (copyright). Scenes subscribe to playback time here
 * so they can react to the song without owning the player.
 *
 *   import { onSongTime, playSong } from '../../shared/youtube';
 *   onSongTime((seconds, playing) => { ... });
 */

/** Avril Lavigne - Complicated (Official Video), channel AvrilLavigneVEVO. */
export const VIDEO_ID = '5NPBIwQyPWE';

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
}

interface YTPlayerOptions {
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
  };
}

interface YTNamespace {
  Player: new (host: HTMLElement, options: YTPlayerOptions) => YTPlayer;
  PlayerState: { UNSTARTED: -1; ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | undefined;

function loadApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error('YouTube IFrame API signalled ready without window.YT'));
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('Could not load the YouTube IFrame API'));
    document.head.append(script);
  });
  return apiPromise;
}

type TimeListener = (seconds: number, playing: boolean) => void;

const listeners = new Set<TimeListener>();
let player: YTPlayer | undefined;
let playing = false;
let ticker: number | undefined;

/** Mount the player into `host`. Call once, from the song scene. Resolves when the player is ready. */
export async function mountSongPlayer(host: HTMLElement): Promise<void> {
  if (player) throw new Error('The song player is already mounted');
  const YT = await loadApi();
  await new Promise<void>((resolve) => {
    player = new YT.Player(host, {
      videoId: VIDEO_ID,
      width: '100%',
      height: '100%',
      playerVars: { rel: 0, playsinline: 1 },
      events: {
        onReady: () => resolve(),
        onStateChange: (event) => {
          playing = event.data === YT.PlayerState.PLAYING;
          if (playing) startTicking();
          else stopTicking();
          notify();
        },
      },
    });
  });
}

/** Subscribe to playback time (about 4 updates per second while playing). Returns an unsubscribe. */
export function onSongTime(listener: TimeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSongTime(): number {
  return player?.getCurrentTime() ?? 0;
}

export function getSongDuration(): number {
  return player?.getDuration() ?? 0;
}

export function isSongPlaying(): boolean {
  return playing;
}

/** Browsers only allow this in response to a user gesture (a click). */
export function playSong(): void {
  player?.playVideo();
}

export function pauseSong(): void {
  player?.pauseVideo();
}

export function seekSong(seconds: number): void {
  player?.seekTo(seconds, true);
}

function startTicking(): void {
  if (ticker !== undefined) return;
  ticker = window.setInterval(notify, 250);
}

function stopTicking(): void {
  if (ticker === undefined) return;
  window.clearInterval(ticker);
  ticker = undefined;
}

function notify(): void {
  const seconds = getSongTime();
  for (const listener of listeners) {
    try {
      listener(seconds, playing);
    } catch (err) {
      console.error('[song] a time listener threw', err);
    }
  }
}
