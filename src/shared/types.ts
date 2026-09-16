/**
 * The contract every scene fulfils.
 * One default export of this shape per `src/scenes/<id>/index.ts`.
 */
export interface Scene {
  /** kebab-case, must equal the folder name. Becomes the section id and anchor. */
  id: string;
  /** Shown in the nav. */
  title: string;
  /** Lower numbers come first. Intro is 10, outro is 100. Pick a free slot in between. */
  order: number;
  /** Your name, for the credits. */
  author?: string;
  /**
   * Build your scene inside `root`, an empty `<section data-scene="id">`.
   * The shell adds the `is-active` class and dispatches `scene:enter` / `scene:leave`
   * events on `root` as it scrolls in and out of view.
   */
  mount(root: HTMLElement): void;
}
