import './scene.css';
import type { Scene } from '../../shared/types';
import { prefersReducedMotion } from '../../shared/prefs';

const TITLE = 'Complicated';

const scene: Scene = {
  id: 'intro',
  title: 'Intro',
  order: 10,
  author: 'shell',

  mount(root) {
    const letters = [...TITLE]
      .map((ch, i) => `<span class="intro-letter" style="--i:${i}">${ch}</span>`)
      .join('');

    root.innerHTML = `
      <div class="intro-wrap">
        <p class="intro-kicker">Avril Lavigne · Let Go · 2002</p>
        <h1 class="intro-title" aria-label="${TITLE}">${letters}</h1>
        <p class="intro-sub">An interactive experience, made by a team in 90 minutes.</p>
        <p class="intro-cue" aria-hidden="true">scroll ↓</p>
      </div>
      <div class="intro-check" aria-hidden="true"></div>
    `;

    if (prefersReducedMotion()) root.classList.add('intro-still');
  },
};

export default scene;
