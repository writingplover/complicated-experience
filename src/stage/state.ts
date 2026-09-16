export type StageState = 'idle' | 'calibrate' | 'countdown' | 'perform' | 'final';

type Listener = (next: StageState, prev: StageState) => void;

export class StateMachine {
  private current: StageState = 'idle';
  private readonly listeners = new Set<Listener>();

  get state(): StageState {
    return this.current;
  }

  set(next: StageState): void {
    if (next === this.current) return;
    const prev = this.current;
    this.current = next;
    for (const listener of this.listeners) listener(next, prev);
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
