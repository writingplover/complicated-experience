/** True when the visitor asked the OS/browser for less motion. Tone animations down. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
