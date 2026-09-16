import './style.css';
import type { Scene } from './shared/types';

// Every src/scenes/<id>/index.ts is a scene. Folders starting with `_` are ignored.
// Nobody needs to register anything here.
const modules = import.meta.glob<{ default: unknown }>(
  ['./scenes/*/index.ts', '!./scenes/_*/index.ts'],
  { eager: true },
);

const scenes = Object.entries(modules)
  .flatMap(([path, mod]) => {
    const candidate = mod.default;
    if (isScene(candidate)) return [candidate];
    console.error(`[shell] ${path} does not default-export a valid Scene`);
    return [];
  })
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

const app = document.querySelector<HTMLElement>('#app');
const nav = document.querySelector<HTMLElement>('#nav');
if (!app || !nav) throw new Error('index.html is missing #app or #nav');

if (scenes.length === 0) {
  app.innerHTML =
    '<section class="scene shell-empty"><p>No scenes yet. Copy <code>src/scenes/_template</code> to get started.</p></section>';
}

const sections = new Map<Element, HTMLAnchorElement>();

for (const scene of scenes) {
  const section = document.createElement('section');
  section.className = 'scene';
  section.id = scene.id;
  section.dataset.scene = scene.id;
  section.setAttribute('aria-label', scene.title);
  app.append(section);

  const link = document.createElement('a');
  link.href = `#${scene.id}`;
  link.textContent = scene.title;
  nav.append(link);
  sections.set(section, link);

  try {
    scene.mount(section);
  } catch (err) {
    console.error(`[scene:${scene.id}] mount() threw`, err);
    section.replaceChildren(errorNotice(scene.title));
  }
}

// Tell scenes when they are on screen so they can start/pause their own animations.
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const link = sections.get(entry.target);
      entry.target.classList.toggle('is-active', entry.isIntersecting);
      link?.classList.toggle('is-active', entry.isIntersecting);
      entry.target.dispatchEvent(new CustomEvent(entry.isIntersecting ? 'scene:enter' : 'scene:leave'));
    }
  },
  { threshold: 0.5 },
);
for (const section of sections.keys()) observer.observe(section);

function isScene(value: unknown): value is Scene {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.order === 'number' &&
    typeof v.mount === 'function'
  );
}

function errorNotice(title: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'shell-error';
  p.textContent = `“${title}” didn't load. Check the console.`;
  return p;
}
