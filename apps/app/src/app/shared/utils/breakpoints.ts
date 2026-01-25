/**
 * Constantes de breakpoints unificadas según Tailwind CSS v4
 *
 * Breakpoints estándar:
 * - sm: 640px
 * - md: 768px
 * - lg: 1024px (breakpoint principal mobile/desktop)
 * - xl: 1280px
 */
export const KENGO_BREAKPOINTS = {
  SM: '(min-width: 640px)',
  MD: '(min-width: 768px)',
  LG: '(min-width: 1024px)',
  XL: '(min-width: 1280px)',
  MOBILE: '(max-width: 767.98px)',
  DESKTOP: '(min-width: 1024px)',
} as const;

export type BreakpointKey = keyof typeof KENGO_BREAKPOINTS;
