import './scene.css';
import type { Scene } from '../../shared/types';
import { mountSongPlayer, onSongTime } from '../../shared/youtube';

/** The official video, embedded. Other scenes read playback time via src/shared/youtube.ts. */
const scene: Scene = {
  id: 'song',
  title: 'The Song',
  order: 20,
  author: 'shell',

  mount(root) {
    root.innerHTML = `
      <div class="song-wrap">
        <p class="song-kicker">Press play. The song keeps going while you scroll.</p>
        <div class="song-frame"><div class="song-host"></div></div>
        <p class="song-status"><span class="song-time">0:00</span> · paused</p>
      </div>
    `;

    const host = root.querySelector<HTMLElement>('.song-host');
    const status = root.querySelector<HTMLElement>('.song-status');
    if (!host || !status) throw new Error('song scene markup is missing elements');

    mountSongPlayer(host).catch((err: unknown) => {
      console.error('[song] player failed to load', err);
      status.textContent = 'The YouTube player could not load. Check your network or ad blocker.';
    });

    onSongTime((seconds, playing) => {
      status.innerHTML = `<span class="song-time">${formatTime(seconds)}</span> · ${playing ? 'playing' : 'paused'}`;
    });
  },
};

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const m = Math.floor(whole / 60);
  const s = String(whole % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default scene;
