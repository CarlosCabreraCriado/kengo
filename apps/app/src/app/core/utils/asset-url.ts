import { environment } from '../../../environments/environment';

export interface AssetUrlOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'inside' | 'outside';
  format?: 'webp' | 'jpg' | 'png' | 'avif';
  quality?: number;
  /**
   * Extensión del archivo en R2 (sin punto). Default: `webp` para imágenes.
   * Pasa `mp4` para vídeos o cualquier otra extensión que tenga el archivo.
   * Si la `key` ya termina en una extensión conocida, se respeta y este campo
   * se ignora.
   */
  extension?: string;
  /** Sufijo extra de cache-busting (no usado por R2, mantenido por compat). */
  key?: string;
}

const KNOWN_EXTENSIONS = new Set([
  'webp', 'jpg', 'jpeg', 'png', 'avif', 'gif', 'mp4', 'webm', 'mov', 'pdf',
]);

function ensureExtension(rawKey: string, ext?: string): string {
  // Si la key ya termina en una extensión conocida, no añadir nada.
  const lastDot = rawKey.lastIndexOf('.');
  if (lastDot > -1) {
    const candidate = rawKey.slice(lastDot + 1).toLowerCase();
    if (KNOWN_EXTENSIONS.has(candidate)) return rawKey;
  }
  return ext ? `${rawKey}.${ext}` : rawKey;
}

/**
 * Construye una URL de asset servida desde Cloudflare R2 (`assets.kengoapp.com`)
 * o desde el proxy Directus durante la transición.
 *
 * Patrón de keys en R2 (heredado de Directus storage):
 * - Imágenes (portadas, avatares, logos): `<uuid>.webp`
 * - Vídeos: `<uuid>.mp4`
 *
 * Cloudflare Image Resizing parsea `?width=...&format=...` igual que Directus.
 * El swap entre Directus y R2 se hace cambiando únicamente `ASSETS_URL`.
 */
export function assetUrl(
  key: string | number | undefined | null,
  opts?: AssetUrlOptions,
): string {
  if (key === null || key === undefined || key === '') return '';

  const base = environment.ASSETS_URL.replace(/\/$/, '');
  const keyWithExt = ensureExtension(String(key), opts?.extension ?? 'webp');

  const params = new URLSearchParams();
  if (opts?.width) params.set('width', String(opts.width));
  if (opts?.height) params.set('height', String(opts.height));
  if (opts?.fit) params.set('fit', opts.fit);
  if (opts?.format) params.set('format', opts.format);
  if (opts?.quality !== undefined) params.set('quality', String(opts.quality));
  if (opts?.key) params.set('key', opts.key);

  const qs = params.toString();
  return qs ? `${base}/${keyWithExt}?${qs}` : `${base}/${keyWithExt}`;
}

/**
 * Atajo: URL con transformación estándar de portada (webp + cover).
 */
export function thumbnailUrl(
  key: string | number | undefined | null,
  width = 400,
  height = 300,
): string {
  return assetUrl(key, { width, height, fit: 'cover', format: 'webp' });
}

/**
 * Atajo: URL sin transformación (avatar, logo, portada original).
 * Default extension: `.webp`.
 */
export function rawAssetUrl(key: string | number | undefined | null): string {
  return assetUrl(key);
}

/**
 * Atajo: URL de vídeo (`.mp4`). Sin transformación de imagen.
 */
export function videoUrl(key: string | number | undefined | null): string {
  return assetUrl(key, { extension: 'mp4' });
}
