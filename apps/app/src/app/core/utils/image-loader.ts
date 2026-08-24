import { ImageLoaderConfig } from '@angular/common';
import { isAssetsUrl } from './asset-host.store';

/**
 * Image loader para `NgOptimizedImage` compatible con `assetUrl()` (Cloudflare R2).
 *
 * Cuando `src` apunta a una base de assets (`ASSETS_URL` o `ASSETS_FALLBACK_URL`,
 * ver asset-host.store.ts), Angular llama al
 * loader con `width` (basado en device pixel ratio + `[width]` del template) y
 * opcionalmente `loaderParams` con `height`, `fit` y `quality`. El loader reescribe
 * los query params para que Cloudflare Image Resizing genere la variante adecuada.
 *
 * Si `src` no es de R2 (logos SVG, blobs de preview, etc.), devuelve la URL sin
 * tocar para que `<img ngSrc>` siga funcionando con assets locales.
 */
export function kengoImageLoader(config: ImageLoaderConfig): string {
  if (!isAssetsUrl(config.src)) return config.src;

  const url = new URL(config.src);
  url.searchParams.delete('width');
  url.searchParams.delete('height');
  if (config.width) url.searchParams.set('width', String(config.width));

  const params = config.loaderParams ?? {};
  if (params['height']) url.searchParams.set('height', String(params['height']));
  if (params['fit']) url.searchParams.set('fit', String(params['fit']));
  url.searchParams.set('format', 'webp');
  url.searchParams.set('quality', String(params['quality'] ?? 80));
  return url.toString();
}
