import './scene.css';
import type { Scene } from '../../shared/types';
import { prefersReducedMotion } from '../../shared/prefs';

/**
 * HOW TO START YOUR SCENE
 * 1. Copy this folder to src/scenes/<your-id>/   (kebab-case, e.g. skate-park)
 * 2. Set `id` to the folder name, pick a free `order`, add your name.
 * 3. Rename the CSS class prefix `template-` to `<your-id>-` in both files.
 * 4. Build your DOM inside mount(). Keep every asset in your folder.
 * That's it: the shell finds your scene automatically.
 */
const scene: Scene = {
  id: '_template',
  title: 'Template',
  order: 999,
  author: 'you',

  mount(root) {
    root.innerHTML = `
      <div class="template-wrap">
        <h2 class="template-title">Your scene title</h2>
        <p class="template-body">Something about the song. You have 90 minutes.</p>
      </div>
    `;

    // The shell adds `.is-active` to `root` and fires these events as you scroll in/out.
    root.addEventListener('scene:enter', () => {
      // start animations, timers, audio
    });
    root.addEventListener('scene:leave', () => {
      // pause them again
    });

    if (prefersReducedMotion()) {
      // keep it calm: no autoplaying motion, no parallax
    }
  },
};

export default scene;
