/**
 * Constantes de breakpoints unificadas según Tailwind CSS v4.
 *
 * Mobile-first (min-width):
 * - SM: 640px
 * - MD: 768px
 * - LG: 1024px (breakpoint principal mobile/desktop)
 * - XL: 1280px
 * - XXL: 1536px
 *
 * Aliases semánticos (preferidos en componentes):
 * - MOBILE: < md
 * - TABLET: md..lg (rango exclusivo)
 * - DESKTOP: ≥ lg
 *
 * Desktop-first (max-width) para casos que lo necesiten.
 */
export const KENGO_BREAKPOINTS = {
  SM: '(min-width: 640px)',
  MD: '(min-width: 768px)',
  LG: '(min-width: 1024px)',
  XL: '(min-width: 1280px)',
  XXL: '(min-width: 1536px)',

  MOBILE: '(max-width: 767.98px)',
  TABLET: '(min-width: 768px) and (max-width: 1023.98px)',
  DESKTOP: '(min-width: 1024px)',

  BELOW_SM: '(max-width: 639.98px)',
  BELOW_LG: '(max-width: 1023.98px)',
} as const;

export type BreakpointKey = keyof typeof KENGO_BREAKPOINTS;
