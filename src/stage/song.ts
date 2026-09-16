/**
 * Plays the local MP3 through Web Audio and exposes a beat grid. When the file is missing the
 * performance still runs for 60 seconds in silence so the stage never blocks on it.
 */
export class Song {
  readonly bpm: number;
  readonly url: string;
  /** Seconds from file start to the first beat. Adjust with [ and ] in the debug panel. */
  beatOffset = 0;
  loaded = false;
  missingReason = 'not loaded yet';

  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private startedAt = 0;
  private playing = false;
  private silentTimer: number | undefined;
  private lastBeatIndex = -1;
  private readonly endedListeners = new Set<() => void>();

  constructor(url: string, bpm: number) {
    this.url = url;
    this.bpm = bpm;
  }

  async load(): Promise<boolean> {
    try {
      const res = await fetch(this.url);
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || type.includes('text/html')) {
        this.missingReason = `no file at ${this.url}`;
        return false;
      }
      const data = await res.arrayBuffer();
      this.ctx ??= new AudioContext();
      this.buffer = await this.ctx.decodeAudioData(data);
      this.loaded = true;
      this.missingReason = '';
      return true;
    } catch (err) {
      this.missingReason = err instanceof Error ? err.message : String(err);
      return false;
    }
  }

  get duration(): number {
    return this.buffer?.duration ?? 60;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  async start(): Promise<void> {
    this.stop();
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.startedAt = this.ctx.currentTime;
    this.playing = true;
    this.lastBeatIndex = -1;
    if (this.buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.buffer;
      source.connect(this.ctx.destination);
      source.onended = () => {
        if (this.playing) this.finish();
      };
      source.start();
      this.source = source;
    } else {
      this.silentTimer = window.setTimeout(() => this.finish(), this.duration * 1000);
    }
  }

  stop(): void {
    if (this.source) {
      this.source.onended = null;
      try {
        this.source.stop();
      } catch {
        // already stopped
      }
      this.source = null;
    }
    if (this.silentTimer !== undefined) {
      window.clearTimeout(this.silentTimer);
      this.silentTimer = undefined;
    }
    this.playing = false;
  }

  /** Seconds since start, 0 when not playing. */
  time(): number {
    return this.playing && this.ctx ? this.ctx.currentTime - this.startedAt : 0;
  }

  onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }

  /** True once per beat boundary crossed since the previous call. */
  beatTick(): boolean {
    if (!this.playing) return false;
    const index = Math.floor(((this.time() - this.beatOffset) * this.bpm) / 60);
    if (index !== this.lastBeatIndex) {
      this.lastBeatIndex = index;
      return true;
    }
    return false;
  }

  private finish(): void {
    this.playing = false;
    for (const listener of this.endedListeners) listener();
  }
}
