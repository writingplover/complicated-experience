# Complicated — an interactive experience

## Start here

**Before every action, read `PROJECT.md`.** It holds the current status, the decisions made so
far, and the context for what we are building. When you decide something or finish a milestone,
update `PROJECT.md` in the same commit. If `PROJECT.md` and this file disagree, `PROJECT.md` wins
on *what* we build; this file wins on *how* we work.

## The project

A web experience around Avril Lavigne's "Complicated" (album *Let Go*, 2002), built by a team in
one **90-minute** session. The visitor performs the song; we track the re-enactment through mic,
webcam and taps; a virtual crowd reacts to the performance. Details and ideation live in
`PROJECT.md`. This is a proof of concept, not a production app: no tests required, no backend,
no build pipeline beyond `pnpm build`.

## Stack

- Vite + TypeScript, plain DOM and CSS. No framework, no UI or animation libraries, no ML libraries.
- pnpm. Install with `pnpm install --ignore-scripts`.
- Adding a dependency is a team decision, not an individual one. Say so in the channel first.
  Default to the platform: CSS animations, Canvas, Web Audio, `getUserMedia`, `IntersectionObserver`.

## Working in parallel (everyone commits to `main` at the same time)

These rules exist so several people can push for 90 minutes without merge conflicts.

1. **One scene per person, one folder per scene.** Copy `src/scenes/_template/` to
   `src/scenes/<your-id>/`. Folder name = scene `id`, kebab-case, e.g. `src/scenes/skate-park/`.
   When several people work inside one scene (the stage), each person owns **one file** in it.
2. **Scenes are auto-discovered.** The shell globs `src/scenes/*/index.ts`. You never register
   anything. Folders starting with `_` are ignored.
3. **Do not edit shared files** without announcing it in the channel first: `index.html`,
   `src/main.ts`, `src/style.css`, `src/shared/*`, `package.json`, this file.
   If you must, make it a tiny separate commit.
4. **`PROJECT.md` is the exception: everyone edits it.** Touch only your own table rows or append
   one-line entries. Commit `PROJECT.md` changes immediately and separately so they never sit in a
   conflicting working tree.
5. **Everything you need lives in your folder**: TypeScript, CSS, images, sounds.
   Prefix every CSS class with your scene id (`.skate-park-title`) so styles never collide.
6. **Commit small, commit often, straight to `main`.** No branches, no pull requests, no reviews.
   Before every push: `git pull --rebase` then `git push`.
   Conventional commit messages scoped to your scene: `feat(stage): add crowd canvas`.
7. **Never force-push. Never rewrite `main` history.**
8. **A broken scene must not break the page.** The shell catches errors thrown from `mount()`
   and shows a placeholder instead. Still: run `pnpm typecheck` before you push.
9. **Keep it light.** Under 2 MB of assets per scene. WebP/AVIF for images, short compressed audio.
10. **Respect reduced motion.** Check `prefersReducedMotion()` from `src/shared/prefs.ts` and
    tone animations down when it is true.
11. **Claim an `order` number and your files in `PROJECT.md`** before you start, so two people
    never build the same thing. Intro is 10, the song/stage is 20, verdict is 90, outro is 100.

## The song and copyright

- The recording is **not** in this repo and must not be added. No ripped MP3s, no video files,
  no official artwork or press photos.
- The song plays through the official YouTube embed in `src/scenes/song/`. Any scene can react to
  playback via `src/shared/youtube.ts`: `onSongTime((seconds, playing) => ...)`, `playSong()`,
  `pauseSong()`, `seekSong(s)`.
- Quoting a short lyric fragment (a line or so) inside your scene is fine. A lyrics wall is not.
  Stage cues are directions ("go big"), never lyrics.
- Anything you make yourself (drawings, sounds, copy) is fine.

## Camera and microphone

- Both are optional. Every feature must still work from keyboard taps when permission is denied.
- Frames and audio are processed in the browser and never recorded, stored or sent anywhere.
  Say so in the UI next to the permission buttons.
- Ask for permission on a click, never on page load.

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

- Read `PROJECT.md`, then this file, then `src/shared/types.ts` before doing anything.
- Work inside the user's scene folder (or their claimed file) only. Do not touch shared files
  unless the user explicitly asks; if they do, remind them to announce it in the channel first.
- Start from `_template`. Do not invent a different scene contract or add a framework.
- When the user makes a decision, record it in the `PROJECT.md` decisions table with today's date.
- Run `pnpm typecheck` before suggesting a commit. Use conventional commit messages scoped to the
  scene id.
- Do not paste lyrics, download the recording, or fetch copyrighted media.
- Time-box everything: a working simple scene beats an ambitious unfinished one.
