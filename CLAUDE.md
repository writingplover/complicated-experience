# Complicated — an interactive experience

A small web experience built around Avril Lavigne's "Complicated" (album *Let Go*, 2002).
Built by a team in one **90-minute** session. This is a proof of concept, not a production app:
no tests required, no backend, no build pipeline beyond `pnpm build`.

## The idea in one line

One scrolling page. Each team member owns one **scene** (a full-viewport section) that riffs on
the song: its mood, its themes (posing, pretending, "why'd you have to go and make things so
complicated"), its 2002 pop-punk / skate-mall aesthetic. The shell stitches the scenes together.

## Stack

- Vite + TypeScript, plain DOM and CSS. No framework, no UI or animation libraries.
- pnpm. Install with `pnpm install --ignore-scripts`.
- Adding a dependency is a team decision, not an individual one. Say so in the channel first.
  Default to the platform: CSS animations, Canvas, Web Audio, `IntersectionObserver`.

## Working in parallel (everyone commits to `main` at the same time)

These rules exist so several people can push for 90 minutes without merge conflicts.

1. **One scene per person, one folder per scene.** Copy `src/scenes/_template/` to
   `src/scenes/<your-id>/`. Folder name = scene `id`, kebab-case, e.g. `src/scenes/skate-park/`.
2. **Scenes are auto-discovered.** The shell globs `src/scenes/*/index.ts`. You never register
   anything. Folders starting with `_` are ignored.
3. **Do not edit shared files** without announcing it in the channel first: `index.html`,
   `src/main.ts`, `src/style.css`, `src/shared/*`, `package.json`, this file.
   If you must, make it a tiny separate commit.
4. **Everything you need lives in your folder**: TypeScript, CSS, images, sounds.
   Prefix every CSS class with your scene id (`.skate-park-title`) so styles never collide.
5. **Commit small, commit often, straight to `main`.** No branches, no pull requests, no reviews.
   Before every push: `git pull --rebase` then `git push`.
   Conventional commit messages scoped to your scene: `feat(skate-park): add halfpipe parallax`.
6. **Never force-push. Never rewrite `main` history.**
7. **A broken scene must not break the page.** The shell catches errors thrown from `mount()`
   and shows a placeholder instead. Still: run `pnpm typecheck` before you push.
8. **Keep it light.** Under 2 MB of assets per scene. WebP/AVIF for images, short compressed audio.
9. **Respect reduced motion.** Check `prefersReducedMotion()` from `src/shared/prefs.ts` and
   tone animations down when it is true.
10. **Claim an `order` number in the channel** before you start, so two scenes don't fight for
    the same slot. Intro is 10, the song player is 20, outro is 100. Ties break alphabetically by id.

## The song and copyright

- The recording is **not** in this repo and must not be added. No ripped MP3s, no video files,
  no official artwork or press photos.
- The song plays through the official YouTube embed in `src/scenes/song/`. Any scene can react to
  playback via `src/shared/youtube.ts`: `onSongTime((seconds, playing) => ...)`, `playSong()`,
  `pauseSong()`, `seekSong(s)`.
- Quoting a short lyric fragment (a line or so) inside your scene is fine. A lyrics wall is not.
- Anything you make yourself (drawings, sounds, copy) is fine.

## Scene contract

See `src/shared/types.ts`. In short:

```ts
const scene: Scene = {
  id: 'skate-park',      // must match the folder name
  title: 'Skate Park',   // shown in the nav
  order: 30,
  author: 'Your name',
  mount(root) {          // build your DOM inside `root`
    root.addEventListener('scene:enter', () => { /* on screen */ });
    root.addEventListener('scene:leave', () => { /* off screen */ });
  },
};
export default scene;
```

The shell also toggles the `is-active` class on `root` while the scene is at least half visible.

## Commands

- `pnpm dev` — dev server with hot reload
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm build` — typecheck + production build to `dist/`

## Guidance for Claude Code

- Read this file and `src/shared/types.ts` before writing or editing a scene.
- Work inside the user's scene folder only. Do not touch shared files unless the user explicitly
  asks; if they do, remind them to announce it in the channel first.
- Start from `_template`. Do not invent a different scene contract or add a framework.
- Run `pnpm typecheck` before suggesting a commit. Use conventional commit messages scoped to the
  scene id.
- Do not paste lyrics, download the recording, or fetch copyrighted media.
- Time-box everything: a working simple scene beats an ambitious unfinished one.
