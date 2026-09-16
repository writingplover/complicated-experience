/** True when the visitor asked the OS or browser for less motion. No shake, no strobes. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
