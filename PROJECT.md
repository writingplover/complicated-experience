# PROJECT.md — Air Stage: play "Complicated" like the crowd is really watching

Living document. Read it before every action. Update it when you decide something or finish a
milestone. Keep entries to one line each so parallel edits merge cleanly.

Last updated: 2026-09-16 (hard cuts between crowd clips)

## Status

- Design approved 2026-09-16. **All five build slots are implemented** and verified in demo mode:
  idle → calibrate → countdown → perform (energy, crowd blend, lights, ghost line) → final PNG.
- Still to check on the demo laptop: GPU vs CPU delegate in the debug panel, calibration by
  raising hands, the auto dominant-hand guess, and the 5 s loop seam of the crowd clips.
- Repo: Vite + TypeScript. Dependencies: `vite`, `typescript`, `@mediapipe/tasks-vision` 1.0.1.
- Crowd clips in `public/crowd/` are the generated loops (5 s each), transcoded from the 1080p
  originals to 720p H.264 (0.5–1.7 MB each). Originals stay outside the repo.
- Camera path verified on the demo laptop: MediaPipe loads and tracks. The player is now a small
  portrait panel bottom right so the crowd video is the focus.
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
hand, G toggles the ghost line, R performs again, M toggles demo mode (synthetic performer, for
testing without a camera). `?demo` in the URL starts in demo mode. The deck's transport buttons
trigger the same actions.

## Architecture

Single full-screen page. Static layers in `index.html`, one TypeScript module per concern in
`src/stage/`. Modules talk through plain function calls from `src/main.ts`; nothing global.

| Layer (back → front) | Module | Responsibility |
| --- | --- | --- |
| Crowd videos | `crowd.ts` | Three `<video>` loops, opacity blend per level, lights, shake, flashes |
| Player panel (PiP) | `pose.ts` + `draw.ts` + CSS | Portrait rounded panel bottom right: mirrored dimmed camera feed with the stick figure and guitar drawn over it |
| Ghost line | `ghost.ts` | Move library, picking, drawing on the same canvas |
| Excitement meter + prompts | `prompts.ts` | Vertical pink meter (no labels), centre prompts, countdown, callouts, key hint |
| Deck | `winamp.ts` | Compact Winamp-flavoured bar top right: LCD clock, spectrum, title marquee, progress, transport |
| Final overlay | `final.ts` | Re-render the last pose at 1920×1080, compose PNG, download, perform again |
| Debug panel | `debug.ts` | FPS, delegate, signals, energy, level, file status |
| (no layer) | `pose.ts` | MediaPipe Pose Landmarker wrapper, emits landmarks per frame |
| (no layer) | `demo.ts` | Synthetic landmark source with the same interface as `pose.ts` |
| (no layer) | `calibration.ts` | Shoulder width, dominant hand, presence detection |
| (no layer) | `energy.ts` | Signals → energy → level, pure logic |
| (no layer) | `song.ts` | Web Audio playback of the local MP3, beat grid, YouTube fallback |
| (no layer) | `state.ts` | The five states and transitions |

## Interface (2026-09-16 redesign)

The crowd video is the stage. Everything else stays out of its way.

- **Excitement meter**: a Winamp slider stood upright along the left edge: bevelled black-bordered
  track, segmented hot pink LED fill, a slider handle riding on top, filled by energy 0–100. No
  labels, no numbers; the height is the message. Glows harder at Legendary.
- **Player panel**: the Winamp "video window" bottom right, portrait: title bar, bevels, faint
  scanlines, the camera feed tinted pink and dimmed, the guitarist drawn over it in pale pink with
  black outlines and a hot pink guitar. Small on purpose: the focus is the crowd.
- **Deck**: one compact Winamp-flavoured bar top right, hot pink (`#ff0099`, 2 px black borders,
  Silkscreen pixel font): LCD clock, 19-bar spectrum fed by the five signals, title marquee, song
  progress, transport (reset, start, end, skip, camera/demo), ghost toggle, perform again. Only the
  Winamp elements the stage needs; no EQ, no playlist, no fake stats.
- Prompts, countdown and callouts stay centred over the crowd. The debug panel docks under the deck.
- **Typography**: everything is set in Silkscreen (Google Fonts pixel font), uppercase, with hard
  pink and black drop shadows on the big words. Fallback is the system monospace when offline.

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

- Raw energy = 100 × (weighted sum)^1.25. The curve makes the top of the meter harder to reach:
  a weighted sum of 0.8 gives 76, not 80. Smoothed energy rises with factor 0.25 per frame and
  falls with 0.03 per frame (fast rise, slow fall). No person → signals decay to zero.
- Levels: Watching < 22, Nodding 22–45, Moving 45–68, Roaring 68–L, Legendary ≥ L.
- **Legendary is adaptive.** L starts at 97 with a 3 s hold and eases (smoothstep on song
  progress) to 82 with a 0.8 s hold by the end of the song. Early Legendary is nearly impossible,
  the last chorus is where it happens. Dropping a level requires energy 5 below the floor for 1 s
  (hysteresis). Rising to the other levels is immediate. The debug panel shows the live floor.
- Beat streak: 4 consecutive on-beat peaks trigger a callout and a small energy bonus.
- Target visible latency under 150 ms: no extra buffering between landmarks and the crowd.

## Crowd

Three muted, looping, always-playing videos stacked in one box. Level picks exactly one clip
with a **hard cut**, no crossfade (decided 2026-09-16):

| Level | Clip | Effects |
| --- | --- | --- |
| Watching | bored | flat house light |
| Nodding | bored | slightly brighter lights |
| Moving | mid | light sweep on the beat |
| Roaring | excited | camera shake on the beat, brighter lights |
| Legendary | excited | strobe flashes on the beat, "CROWD GOES WILD" callout, figure glow |

Reduced-motion preference disables shake and flashes only. Missing or failed videos fall back to a
dark gradient so the stage still works.

### Files

`public/crowd/crowd-1-bored.mp4`, `crowd-2-mid.mp4`, `crowd-3-excited.mp4`. H.264 MP4, 1280×720,
5 s loops, 0.5–1.7 MB each, transcoded from the generated 1080p originals with
`ffmpeg -vf scale=1280:-2 -an -c:v libx264 -crf 24 -pix_fmt yuv420p -movflags +faststart`.

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

Song end or Escape freezes the moment. A 1920×1080 canvas composes: the **real camera image**
at that instant (mirrored like the stage, cover-fitted, dark bands top and bottom for text), the
tracked figure faintly over it, score, peak level, title ("Legendary at 3:41"), the song name and a
line saying the file is saved locally only. In demo mode there is no camera, so the figure is
drawn at full strength on a dark background. Download saves the PNG; nothing is uploaded.
Perform again restarts at the countdown with the same calibration.

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
| 2026-09-16 | Player rendered small in a portrait panel bottom right | Full-size figure hid the crowd; the crowd video is the focus |
| 2026-09-16 | Excitement shown as a vertical pink meter on the left, no labels | The mock: a visual indicator, not a dashboard |
| 2026-09-16 | Winamp influence limited to a compact hot pink deck (clock, spectrum, title, progress, transport) | User asked for the necessary elements only, not a one-to-one copy |
| 2026-09-16 | Crowd clips committed as 720p transcodes of the generated originals | Keeps the repo under a few MB while the clips sit dimmed behind everything |
| 2026-09-16 | Winamp skin applied to the meter (upright slider) and the player panel (video window); figure in pale pink with black outlines | User request; ties the three visible elements into one skin |
| 2026-09-16 | Legendary is harder: energy curve ^1.25, floors 22/45/68/90, Legendary needs 1.5 s above 90 | Top level came too easily; it should feel earned |
| 2026-09-16 | All typography in the Silkscreen pixel font | One skin for every visible element, as requested |
| 2026-09-16 | Legendary floor and hold ease with song progress: 97 / 3 s at the start → 82 / 0.8 s at the end | Start really hard, get progressively easier, so the climax lands late in the song |
| 2026-09-16 | Share frame is the real camera image at the freeze moment, figure faintly overlaid | A photo is the thing people actually want to keep; still local-only, nothing uploaded |
| 2026-09-16 | Crowd clips hard-cut instead of crossfading; bored/bored/mid/excited/excited across the five levels | Cuts feel like a live broadcast; blends looked muddy |

## Open questions

- First-beat offset of the MP3 (set with `[` `]` in the debug panel, then hardcode it).
- The 5 s crowd loops may show a seam; longer or cross-faded loops if it bothers anyone.
- Which laptop and monitor for the demo; test camera framing at 2–3 m there.

## Cut for now

Microphone and singing, pitch detection, lyric timing, multiplayer, leaderboards, QR sharing,
mobile layout, replay recording, any backend, following-the-ghost-line scoring.
