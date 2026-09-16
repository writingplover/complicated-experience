# PROJECT.md — Air Stage: play "Complicated" like the crowd is really watching

Living document. Read it before every action. Update it when you decide something or finish a
milestone. Keep entries to one line each so parallel edits merge cleanly.

Last updated: 2026-09-16 (approved design, build started)

## Status

- Design approved 2026-09-16. **All five build slots are implemented** and verified in demo mode:
  idle → calibrate → countdown → perform (energy, crowd blend, lights, ghost line) → final PNG.
- Not yet verified with a real camera: MediaPipe load time, GPU delegate, calibration by raising
  hands, auto dominant-hand guess. First thing to test on the demo laptop.
- Repo: Vite + TypeScript. Dependencies: `vite`, `typescript`, `@mediapipe/tasks-vision` 1.0.1.
- Crowd clips in `public/crowd/` are **ffmpeg placeholders**. Replace them with the AI-generated
  loops (prompts below) using the same filenames.
- The song must be dropped at `public/local/complicated.mp3` on each machine. The folder is
  gitignored and audio files are ignored repo-wide. The repo is public.
- Not production-grade: no tests, no bundle budget, no browser matrix beyond current Chrome.

## Context

- Song: "Complicated" by Avril Lavigne, debut single from *Let Go* (2002), 4 min 13 s in the file
  we use, about 78 BPM (measure the first-beat offset in the debug panel).
- Hardware: laptop webcam, laptop drives an external monitor in full-screen. Player stands 2–3 m
  from the camera, full body in frame.
- The camera and pose data never leave the browser. Nothing is recorded or uploaded. The UI says so.

## The concept

The player stands in front of the camera and plays **air guitar** to the song. MediaPipe Pose
tracks shoulders, elbows, wrists, hips, knees and head. Speed, scale, rhythm and variety of the
movement become one **energy** score from 0 to 100. A **virtual concert crowd**, three video loops
blended by energy, goes from quietly watching to completely wild. A **ghost line** suggests one
possible next move every few seconds. The performance ends on a **hero pose** with a downloadable
frame. The player should always look like the star; the crowd is emotional reward, not distraction.

## Experience flow (states)

| # | State | What the player sees | Exit |
| --- | --- | --- | --- |
| 1 | `idle` | "Step in": dark stage, bored crowd, an oval silhouette guide | A person is detected for 1 s, or Space |
| 2 | `calibrate` | "Raise both hands" | Both wrists above the head for 1.5 s → auto dominant hand; one wrist alone for 1 s → that hand is dominant |
| 3 | `countdown` | 3, 2, 1 | Song starts on 0 |
| 4 | `perform` | Full song. Crowd, meter, ghost line live | Song ends, or Escape |
| 5 | `final` | Frozen hero pose, score, peak level, title, Download PNG, Perform again | Space → `idle` |

Keys: Space advances, Escape ends a performance, D toggles the debug panel, H swaps the dominant
hand, M toggles demo mode (synthetic performer, for testing without a camera). `?demo` in the URL
starts in demo mode.

## Architecture

Single full-screen page. Static layers in `index.html`, one TypeScript module per concern in
`src/stage/`. Modules talk through plain function calls from `src/main.ts`; nothing global.

| Layer (back → front) | Module | Responsibility |
| --- | --- | --- |
| Crowd videos | `crowd.ts` | Three `<video>` loops, opacity blend per level, lights, shake, flashes |
| Camera feed | `pose.ts` + CSS | `getUserMedia` lives in the pose source; the `<video>` is mirrored, dimmed and desaturated in CSS |
| Figure canvas | `draw.ts` | Stick figure with a guitar from landmarks, mirrored |
| Ghost line | `ghost.ts` | Move library, picking, drawing on the same canvas |
| HUD + prompts | `hud.ts` | Energy pill, meter, level, callouts, state prompts, countdown |
| Final overlay | `final.ts` | Freeze, compose 1920×1080 PNG, download, restart |
| Debug panel | `debug.ts` | FPS, delegate, signals, energy, level, file status |
| (no layer) | `pose.ts` | MediaPipe Pose Landmarker wrapper, emits landmarks per frame |
| (no layer) | `demo.ts` | Synthetic landmark source with the same interface as `pose.ts` |
| (no layer) | `calibration.ts` | Shoulder width, dominant hand, presence detection |
| (no layer) | `energy.ts` | Signals → energy → level, pure logic |
| (no layer) | `song.ts` | Web Audio playback of the local MP3, beat grid, YouTube fallback |
| (no layer) | `state.ts` | The five states and transitions |

## Pose sensor

- `@mediapipe/tasks-vision` Pose Landmarker, **lite** model (5.8 MB) from Google's model storage,
  WASM from jsdelivr pinned to the installed package version. GPU delegate, CPU fallback.
- `runningMode: 'VIDEO'`, `numPoses: 1`, detection on `requestVideoFrameCallback`.
- Landmarks used: 0 nose, 11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips, 25/26 knees,
  27/28 ankles. All distances are divided by shoulder width so distance to camera does not matter.
- Presence: shoulders and hips visible above 0.5 for the current frame.

## Energy engine

| Signal | Source | Normalisation | Weight |
| --- | --- | --- | --- |
| Strum | speed of the dominant wrist | 0–4 shoulder widths/s → 0–1 | 30% |
| Body | mean speed of torso centre, knees and head | 0–1.5 sw/s → 0–1 | 25% |
| Timing | regularity of wrist-speed peaks against the beat period, its quarter, half and double, phase-free | share of last 8 intervals within ±15% | 20% |
| Scale | dominant wrist to same-side shoulder, rolling max over 1 s | 0.5–1.6 sw → 0–1 | 15% |
| Variety | distinct coarse poses (wrist cells relative to torso, lean sign) in a 6 s window | count/8 → 0–1 | 10% |

- Raw energy = 100 × weighted sum. Smoothed energy rises with factor 0.25 per frame and falls
  with 0.03 per frame (fast rise, slow fall). No person → signals decay to zero.
- Levels: Watching < 20, Nodding 20–40, Moving 40–60, Roaring 60–80, Legendary ≥ 80. Dropping a
  level requires energy 5 below the threshold for 1 s (hysteresis). Rising is immediate.
- Beat streak: 4 consecutive on-beat peaks trigger a callout and a small energy bonus.
- Target visible latency under 150 ms: no extra buffering between landmarks and the crowd.

## Crowd

Three muted, looping, always-playing videos stacked in one box. Level sets opacities with a
600 ms transition:

| Level | bored | mid | excited | Effects |
| --- | --- | --- | --- | --- |
| Watching | 1.0 | 0 | 0 | flat house light |
| Nodding | 0.5 | 0.5 | 0 | slow light sweep |
| Moving | 0 | 1.0 | 0 | light sweep on the beat |
| Roaring | 0 | 0.4 | 0.6 | camera shake on the beat, brighter lights |
| Legendary | 0 | 0 | 1.0 | strobe flashes on the beat, "CROWD GOES WILD" callout |

Reduced-motion preference disables shake and flashes only. Missing or failed videos fall back to a
dark gradient so the stage still works.

### Files

`public/crowd/crowd-1-bored.mp4`, `crowd-2-mid.mp4`, `crowd-3-excited.mp4`. H.264 MP4, 1280×720,
10–15 s seamless loop, under 15 MB each. Current files are ffmpeg placeholders.

### Generation prompts (Veo, Runway, Sora or similar)

Shared base: *Cinematic wide shot from a concert stage looking out at an indoor crowd of about 60
people. Dark venue, haze, deep purple and teal stage lighting, photoreal, locked camera, 16:9,
seamless loop, no text, no logos, no performer in frame.*

1. bored: *…the crowd stands still, arms crossed, a few looking at phones, one or two nodding
   slightly, flat dim house lights, low energy, almost no movement.*
2. mid: *…the crowd nods and sways to a mid-tempo rock song, heads bobbing, a few hands raised,
   moving lights sweep slowly across, warm engaged energy.*
3. excited: *…the crowd jumps in unison, all hands in the air, phone lights waving, strobes,
   confetti falling, roaring, maximum energy.*

## Song

- `public/local/complicated.mp3`, loaded with `fetch` + `decodeAudioData`, played through an
  `AudioBufferSourceNode`. Time = `context.currentTime - startedAt`.
- Beat grid: fixed BPM (78) plus a first-beat offset adjustable in the debug panel with `[` and `]`.
  Timing scoring is phase-free, so a wrong offset only affects light sweeps and shake.
- If the file is missing: the idle prompt says where to put it, and a performance still runs for
  60 s in silence with the phase-free timing signal. The existing YouTube helper is the fallback
  audio source when time allows; it is not required for the demo.

## Ghost line

Six moves as line figures anchored to the player's shoulders and hips: power strum, low stance,
guitar lift, windmill, side lean, overhead finish. Every 2–4 s one move is picked that fits the
current level (low → power strum, low stance; mid → guitar lift, side lean; high → windmill,
overhead finish) and is not the previous one. Drawn as dashed lines at 35% opacity, animated
about 400 ms ahead, then dissolved over 600 ms. No error messages, no skeleton dots, no scoring
of whether the player followed it.

## Final pose

Song end or Escape freezes the last frame. A 1920×1080 canvas composes: dark background, the
frozen figure, score, peak level, title ("Legendary at 2:41"), the song name. Download button
saves a PNG. Perform again returns to `idle`.

- Score = mean energy × 10 (0–1000), peak level = highest level held for at least 2 s.

## Debug and demo

- Debug panel (D): FPS, delegate, presence, dominant hand, five raw signals, raw and smoothed
  energy, level, beat offset, whether song and crowd files loaded.
- Demo mode (M or `?demo`): a synthetic performer whose energy cycles through all five levels over
  40 s. Used to test everything downstream of the sensor without a camera.

## Build order and time

| Slot | Work | Done when |
| --- | --- | --- |
| 1 | pose + demo source, calibration, energy, debug panel | debug panel shows live signals |
| 2 | crowd videos, lights, meter, HUD | level changes visibly move the crowd |
| 3 | state flow, song, countdown, prompts | full run from step in to song end |
| 4 | ghost line | suggestions appear and dissolve during perform |
| 5 | final pose + PNG | download works |

## Shortcuts taken (flag for anyone reusing this)

No automated tests. Fixed BPM instead of onset detection. Lite pose model only. Chrome only.
Model and WASM load from third-party CDNs at runtime. No error tracking, no analytics.

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-09-16 | Vite + TypeScript, plain DOM/CSS, no framework | 90 minutes, few dependencies, everyone can read it |
| 2026-09-16 | Superseded: one scene folder per person, auto-discovered | Replaced by one module per concern under `src/stage/` after the pivot |
| 2026-09-16 | Superseded: song plays only through the official YouTube embed | Replaced by local MP3; the embed stays as optional fallback |
| 2026-09-16 | Superseded: no ML libraries for tracking | Replaced by MediaPipe Pose |
| 2026-09-16 | Superseded: camera tracking is grid frame differencing | Replaced by MediaPipe Pose |
| 2026-09-16 | Pivot to the "Air Stage" board: one full-screen air-guitar stage on a laptop driving an external monitor, no scrolling page | The scroll shell was a means, not the goal; the board is the first real draft |
| 2026-09-16 | Camera tracking is MediaPipe Pose Landmarker, frame differencing kept only as a fallback idea | Strum speed, scale and the ghost line need joint positions; one dependency accepted |
| 2026-09-16 | Crowd is three AI-generated video loops (bored, mid, excited) committed to the repo, five levels blended over them | Our own footage, no licence problem in a public repo, consistent look |
| 2026-09-16 | Song plays from a local MP3 in a gitignored folder, full length; the file is never committed | Web Audio gives beat timing; the repo is public so the recording stays out |
| 2026-09-16 | Final pose composes a PNG on canvas and offers a download; no upload, no backend | Shareable without accounts or infrastructure |
| 2026-09-16 | Solo build with Claude Code, in sequence: sensor and energy, crowd video, stage flow, ghost line, final pose | Team availability; parallel-work rules stay for later contributors |
| 2026-09-16 | Timing signal is phase-free (interval regularity against the beat period) | Works without knowing the first-beat offset and without the song file |
| 2026-09-16 | Demo mode with a synthetic performer ships in the app | Testing without a camera, and a safety net for the live demo |

## Open questions

- First-beat offset of the MP3 (set with `[` `]` in the debug panel, then hardcode it).
- Replace the placeholder crowd clips with the generated ones.
- Which laptop and monitor for the demo; test camera framing at 2–3 m there.

## Cut for now

Microphone and singing, pitch detection, lyric timing, multiplayer, leaderboards, QR sharing,
mobile layout, replay recording, any backend, following-the-ghost-line scoring.
