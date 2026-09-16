# PROJECT.md — Complicated: perform the song, the crowd reacts

Living document. Read it before every action. Update it when you decide something or finish a
milestone. Keep entries to one line each so parallel edits merge cleanly.

Last updated: 2026-09-16 (kickoff)

## Status

- Repo scaffolded: Vite + TypeScript shell, scenes auto-discovered from `src/scenes/*/index.ts`.
- Working scenes: `intro` (title card, order 10) and `song` (official YouTube embed, order 20).
- `src/shared/youtube.ts` exposes playback time and play/pause to every scene.
- Concept below is **ideation, not decided**. Decide at kickoff, log decisions in the table.
- Time box: 90 minutes total. Nothing here is production-grade and nothing needs to be.

## Context

- Song: "Complicated" by Avril Lavigne, debut single from *Let Go* (2002). Roughly four minutes,
  mid-tempo pop-punk (around 78 BPM, confirm against the player). Themes: authenticity versus
  posing, frustration with someone who acts differently around other people.
- Official video: Avril and the band messing around in a mall and skate park, 2002 skater
  aesthetic: baggy jeans, tank tops, neckties, wrist bands, chain wallets.
- Audio only through the official YouTube embed. No recording, no lyrics beyond a short fragment,
  no official artwork in the repo. See CLAUDE.md.
- Team works in parallel on `main`, one scene folder per person. See CLAUDE.md.

## The concept

The visitor **performs** the song. We **track** the re-enactment through the microphone, the
webcam and taps, turn it into one **hype** number, and a **virtual crowd** reacts to it live:
bored when the visitor stands still, ecstatic when they belt the chorus with their arms up.
At the end the crowd delivers a verdict.

Why this fits the song: the video is Avril playing at a crowd for fun, the lyric is about being
yourself instead of posing. The experience rewards going all in and punishes standing still.

## Ideation

### 1. Tracking the performance (inputs)

Three tiers, each independent, so a visitor who denies camera access still gets a show.

| Tier | Input | Signal | How (zero dependencies) |
| --- | --- | --- | --- |
| 0 | Keyboard / tap / click | `tap` energy, beat timing | Count taps per beat window, compare against BPM |
| 1 | Microphone | `voice` energy 0–1 | Web Audio `AnalyserNode`, RMS loudness, smoothed |
| 2 | Webcam | `motion` energy 0–1, `armsUp` flag, `jump` flag | **Decided:** grid frame differencing. Downscale to ~64×48, split into a 3×3 grid, count pixels per cell whose difference to the previous frame exceeds a threshold (robust to auto-exposure). Top row active = arms up. Vertical velocity of the motion centroid oscillating = jumping. Two-second calibration sets the noise floor. |

- No ML pose libraries. MediaPipe or TensorFlow.js cost a dependency and most of the 90 minutes.
- Camera and mic frames never leave the browser. No recording, no upload. Say this on screen.
- Calibration: two seconds of "stand still" to measure noise floor for mic and camera.

### 2. The hype signal

- `hype ∈ [0, 1]`, exponential moving average of `0.5·voice + 0.4·motion + 0.1·tap`.
- Multiplied by a section weight from the song timeline: verse ×1.0, pre-chorus ×1.2, chorus ×1.5.
- Decays towards zero when inputs go quiet, so the crowd calms down within a few seconds.
- Lives in `src/shared/performance.ts`: `reportSample({ voice, motion, tap })`, `onHype(cb)`,
  `getHype()`, `getSection()`. Sensors write, crowd and meter read. Nobody talks to sensors directly.

### 3. The crowd

- Canvas, 100–200 procedural silhouettes (head circle, body rectangle, two arm lines), rows with
  depth scaling, dark palette with pink and lime accents.
- Crowd states by hype: **bored** (< 0.2, still, occasional drift), **nodding** (0.2–0.5, bob on
  the beat), **bouncing** (0.5–0.8, jumping, arms up), **ecstatic** (> 0.8, phone lights, confetti,
  "CROWD GOES WILD" callout).
- Sound: crowd noise is optional. If we want it, record our own cheers (allowed), keep them short.
- Beat sync uses BPM and `getSongTime()`, not audio analysis of the video.

### 4. Song timeline (fill in from the player)

| Section | Start | Weight | Cue shown to the performer |
| --- | --- | --- | --- |
| Intro | 0:00 | 0.8 | "Get ready" |
| Verse 1 | TBD | 1.0 | "Warm up" |
| Pre-chorus | TBD | 1.2 | "Build it" |
| Chorus 1 | TBD | 1.5 | "Go big" |
| Verse 2 | TBD | 1.0 | |
| Pre-chorus | TBD | 1.2 | |
| Chorus 2 | TBD | 1.5 | |
| Bridge | TBD | 1.1 | "Hold it" |
| Final chorus / outro | TBD | 1.5 | "Everything you've got" |

Cues are stage directions, not lyrics. We cannot show lyrics, so the experience assumes the
visitor knows the song. Most people do.

### 5. Flow

1. **Intro** (exists): title card.
2. **Stage**: the video is the festival big screen at the top, the crowd canvas fills the rest,
   webcam preview small in a corner, hype meter on the side, section cue above the crowd.
   Permission buttons for mic and camera, both optional. Press play to start.
3. **Verdict**: after the song ends, a scorecard: peak hype, average hype, best section, crowd
   verdict in one line, a "perform again" button that seeks to 0:00.

### 6. Open design tension: scrolling shell versus a single stage

The shell stacks scenes vertically. Performing needs the video, crowd and meter on one screen.

- Option A (recommended): grow the `song` scene into the `stage`. It owns the layout. Crowd,
  sensors and meter are separate files inside `src/scenes/stage/` owned by different people,
  talking only through `src/shared/performance.ts`. Intro and verdict stay separate scenes.
- Option B: keep `song`, add a `crowd` scene directly below it, both full viewport; the visitor
  sees only one at a time. Weaker experience, zero coordination cost.
- Option C: crowd as a fixed full-page background layer behind all scenes. Cool, but fights the
  one-folder-per-person rule and every scene's readability.

### 7. Things we cut for 90 minutes

Pitch detection, MediaPipe pose or face tracking, lyric timing, multiplayer, leaderboards, mobile camera layout, recording a
replay, any backend. Write them down here if you want them next time.

## 90-minute plan

| Time | What | Who |
| --- | --- | --- |
| 0:00–0:10 | Kickoff: pick option A/B/C, claim files and order numbers, fill this table | all |
| 0:10–0:15 | `src/shared/performance.ts` contract committed first so everyone codes against it | one person |
| 0:15–0:60 | Build in parallel: mic sensor, camera sensor, tap input, crowd canvas, meter + cues, verdict scene | all |
| 0:60–0:75 | Integrate on one machine, fill the song timeline from the player | all |
| 0:75–0:90 | Polish the moment that matters most: chorus hits, crowd goes wild. Demo. | all |

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-09-16 | Vite + TypeScript, plain DOM/CSS, no framework | 90 minutes, two dev dependencies, everyone can read it |
| 2026-09-16 | One scene folder per person, auto-discovered | Zero merge conflicts while everyone pushes to `main` |
| 2026-09-16 | Song plays only through the official YouTube embed | Copyright; also gives us playback time for free |
| 2026-09-16 | No ML libraries for tracking | Dependency and time cost; frame differencing and RMS are enough for a hype signal |
| 2026-09-16 | Camera tracking is grid frame differencing (3×3 grid, thresholded pixel counts, motion centroid velocity) | Zero dependencies, one owner, gives the three signals the crowd needs. MediaPipe Pose deferred to a later iteration behind the same sensor interface |

## Open questions

- Option A, B or C for the stage layout? (decide at kickoff)
- Do we want crowd sound at all, or is the video's audio enough?
- Exact section timestamps: someone scrubs the player and fills the table.
- Who demos, on which machine, with which camera and mic?

## Risks and fallbacks

- Camera or mic permission denied: tier 0 taps still drive the crowd. Never block on permissions.
- YouTube embed blocked (network, ad blocker): the song scene already shows an error line; the
  crowd should still animate from taps.
- Laptop fan noise or a loud room inflates `voice`: the two-second calibration sets the floor.
- Performance on old laptops: keep the canvas at device pixel ratio 1 and the crowd under 200.

## Scene and file claims

| order | id / file | owner | status |
| --- | --- | --- | --- |
| 10 | `intro` | shell | done |
| 20 | `song` (becomes `stage` if option A) | | exists |
| | `src/shared/performance.ts` | | not started |
| | `stage/sensors/mic.ts` | | not started |
| | `stage/sensors/camera.ts` (grid frame differencing) | | not started |
| | `stage/sensors/tap.ts` | | not started |
| | `stage/crowd.ts` | | not started |
| | `stage/meter.ts` (hype meter + section cues) | | not started |
| 90 | `verdict` | | not started |
| 100 | `outro` (optional credits) | | free |
