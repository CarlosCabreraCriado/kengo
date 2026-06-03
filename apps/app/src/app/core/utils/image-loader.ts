import { ImageLoaderConfig } from '@angular/common';
import { environment } from '../../../environments/environment';

/**
 * Image loader para `NgOptimizedImage` compatible con `assetUrl()` (Cloudflare R2).
 *
 * Cuando `src` apunta a la base de R2 (`environment.ASSETS_URL`), Angular llama al
 * loader con `width` (basado en device pixel ratio + `[width]` del template) y
 * opcionalmente `loaderParams` con `height`, `fit` y `quality`. El loader reescribe
 * los query params para que Cloudflare Image Resizing genere la variante adecuada.
 *
 * Si `src` no es de R2 (logos SVG, blobs de preview, etc.), devuelve la URL sin
 * tocar para que `<img ngSrc>` siga funcionando con assets locales.
 */
export function kengoImageLoader(config: ImageLoaderConfig): string {
  const base = environment.ASSETS_URL.replace(/\/$/, '');
  if (!config.src.startsWith(base)) return config.src;

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
