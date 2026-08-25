export const environment = {
  production: false,
  IS_NATIVE_BUILD: false,
  ASSETS_URL: 'https://assets.kengoapp.com',
  // Proxy de R2 en Railway (sin Cloudflare) usado cuando los operadores
  // bloquean las IPs de Cloudflare durante los partidos de LaLiga. Ver
  // core/services/asset-host.service.ts y docs/INFRAESTRUCTURA_RED.md.
  ASSETS_FALLBACK_URL: 'https://media.kengoapp.com',
  CONVEX_URL: 'https://convex.kengoapp.com',
  CONVEX_SITE_URL: 'https://backend.kengoapp.com',
  // Versión de marketing mostrada en el pie de Perfil. Debe mantenerse
  // sincronizada con `package.json`, `android/app/build.gradle` (versionName)
  // e `Info.plist` (MARKETING_VERSION) en cada release.
  APP_VERSION: '1.2.0',
};
