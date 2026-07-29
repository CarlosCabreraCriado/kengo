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
  // Versión de marketing mostrada en el pie de Perfil. Debe mantenerse
  // sincronizada con `package.json`, `android/app/build.gradle` (versionName)
  // e `Info.plist` (MARKETING_VERSION) en cada release.
  APP_VERSION: '1.0.1',
};
