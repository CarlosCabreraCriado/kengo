/**
 * Build de Capacitor (iOS / Android). Igual que `environment.prod.ts` pero
 * con `IS_NATIVE_BUILD: true` para diferenciar configuración o feature flags
 * que se conozcan en build time (sin tener que detectar en runtime).
 */
export const environment = {
  production: true,
  IS_NATIVE_BUILD: true,
  ASSETS_URL: 'https://assets.kengoapp.com',
  CONVEX_URL: 'https://convex.kengoapp.com',
  CONVEX_SITE_URL: 'https://backend.kengoapp.com',
};
