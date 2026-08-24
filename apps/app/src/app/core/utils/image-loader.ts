import { ImageLoaderConfig } from '@angular/common';
import { isAssetsUrl } from './asset-host.store';
import { buildAssetUrl, parseAssetUrl, TransformOptions } from './asset-url';

/**
 * Escalera de anchuras que se piden a Cloudflare. Angular llama al loader con
 * `width` = anchura CSS × densidad (1x/2x) o con los breakpoints de `sizes`;
 * redondear hacia arriba a un peldaño acota el número de variantes únicas por
 * imagen (el plan Free de Images limita a 5.000 transformaciones únicas/mes)
 * y mejora el ratio de caché. `scale-down` nunca amplía, así que pedir un
 * peldaño mayor que el original devuelve el original recodificado.
 */
export const WIDTH_LADDER = [64, 128, 192, 256, 384, 512, 768, 1024, 1536, 1920] as const;

export function snapWidth(width: number): number {
  for (const step of WIDTH_LADDER) {
    if (width <= step) return step;
  }
  return WIDTH_LADDER[WIDTH_LADDER.length - 1];
}

/**
 * Image loader para `NgOptimizedImage` compatible con `assetUrl()` (Cloudflare R2).
 *
 * Cuando `src` apunta a una base de assets (`ASSETS_URL` o `ASSETS_FALLBACK_URL`,
 * ver asset-host.store.ts), Angular llama al loader con `width` (basado en
 * device pixel ratio + `[width]` del template) y opcionalmente `loaderParams`
 * con `height`, `fit` y `quality`. El loader reconstruye la ruta
 * `/cdn-cgi/image/<opciones>/<key>` de Cloudflare Image Transformations con
 * la anchura ajustada a `WIDTH_LADDER`; `fit: 'cover'` solo se emite si hay
 * también `height` (el recorte visual lo hace `object-fit` en CSS).
 *
 * Si `src` no es de R2 (logos SVG, blobs de preview, etc.), devuelve la URL sin
 * tocar para que `<img ngSrc>` siga funcionando con assets locales.
 */
export function kengoImageLoader(config: ImageLoaderConfig): string {
  if (!isAssetsUrl(config.src)) return config.src;

  const parsed = parseAssetUrl(config.src);
  if (!parsed) return config.src;

  const params = config.loaderParams ?? {};
  // Como en el contrato original, `width`/`height` del `src` se descartan: la
  // anchura la dicta Angular y la altura solo llega vía `loaderParams`.
  const opts: TransformOptions = {
    fit: parsed.opts.fit,
    width: config.width ? snapWidth(config.width) : undefined,
    format: 'webp',
    quality: Number(params['quality'] ?? parsed.opts.quality ?? 80),
  };
  if (params['height']) opts.height = Number(params['height']);
  if (params['fit']) opts.fit = String(params['fit']);

  return buildAssetUrl(parsed.base, parsed.key, opts);
}
