import { signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Base activa desde la que se construyen las URLs de assets (imágenes/vídeos
 * de R2). Es un signal a nivel de módulo, no un servicio, para que las
 * funciones puras `assetUrl()` / `kengoImageLoader()` puedan leerlo sin DI.
 *
 * - Valor normal: `environment.ASSETS_URL` (Cloudflare R2 + CDN).
 * - Durante los bloqueos de LaLiga a las IPs de Cloudflare:
 *   `environment.ASSETS_FALLBACK_URL` (proxy en Railway, ver apps/media).
 *
 * Solo `AssetHostService` debe escribirlo. Al ser un signal, cualquier
 * template o `computed` que llame a `assetUrl()` se re-renderiza solo cuando
 * cambia la base, sin que los callers sepan nada del fallback.
 */
const stripSlash = (url: string): string => url.replace(/\/$/, '');

export const ASSETS_PRIMARY_BASE = stripSlash(environment.ASSETS_URL);
export const ASSETS_FALLBACK_BASE = stripSlash(environment.ASSETS_FALLBACK_URL);

const activeBase = signal<string>(ASSETS_PRIMARY_BASE);

/** Base activa (sin barra final). Reactivo. */
export const assetsBase = activeBase.asReadonly();

/** Solo para AssetHostService y tests. */
export function setAssetsBase(base: string): void {
  activeBase.set(stripSlash(base));
}

/** true si `url` apunta a cualquiera de las dos bases de assets. */
export function isAssetsUrl(url: string): boolean {
  return url.startsWith(ASSETS_PRIMARY_BASE) || url.startsWith(ASSETS_FALLBACK_BASE);
}
