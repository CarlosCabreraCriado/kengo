import { assetsBase } from './asset-host.store';

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
  /**
   * @deprecated Sin efecto. Se mantiene por compatibilidad de firma: las keys
   * de R2 son UUID inmutables y un cache-buster solo fragmentaría la caché.
   */
  key?: string;
}

/** Opciones que se serializan en la ruta `/cdn-cgi/image/<opts>/`. */
export interface TransformOptions {
  width?: number;
  height?: number;
  fit?: string;
  format?: string;
  quality?: number;
}

export interface ParsedAssetUrl {
  /** Base sin barra final (`https://assets.kengoapp.com`). */
  base: string;
  /** Key en R2 con extensión (`uuid.webp`). */
  key: string;
  /** Opciones de transformación ya presentes en la URL (normalizadas). */
  opts: TransformOptions;
}

const KNOWN_EXTENSIONS = new Set([
  'webp', 'jpg', 'jpeg', 'png', 'avif', 'gif', 'mp4', 'webm', 'mov', 'pdf',
]);

/** Solo estas extensiones pasan por Image Transformations. */
const IMAGE_EXTENSIONS = new Set(['webp', 'jpg', 'jpeg', 'png', 'avif', 'gif']);

/** Modos de `fit` que exigen `width` y `height` a la vez (Cloudflare avisa y los ignora si falta uno). */
const FITS_REQUIRING_BOTH_DIMENSIONS = new Set(['cover', 'crop', 'pad', 'squeeze']);

const TRANSFORM_PREFIX = '/cdn-cgi/image/';

function extensionOf(key: string): string {
  const lastDot = key.lastIndexOf('.');
  return lastDot > -1 ? key.slice(lastDot + 1).toLowerCase() : '';
}

function ensureExtension(rawKey: string, ext?: string): string {
  // Si la key ya termina en una extensión conocida, no añadir nada.
  if (KNOWN_EXTENSIONS.has(extensionOf(rawKey))) return rawKey;
  return ext ? `${rawKey}.${ext}` : rawKey;
}

function toPositiveInt(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/**
 * Normaliza un conjunto de opciones: descarta valores vacíos o inválidos y
 * aplica la regla de coherencia de Cloudflare (`fit=cover` sin ambas
 * dimensiones se omite).
 */
export function normalizeTransformOptions(opts: TransformOptions | undefined): TransformOptions {
  const out: TransformOptions = {};
  if (!opts) return out;
  const width = toPositiveInt(opts.width);
  const height = toPositiveInt(opts.height);
  if (width) out.width = width;
  if (height) out.height = height;
  if (opts.fit && !(FITS_REQUIRING_BOTH_DIMENSIONS.has(opts.fit) && !(width && height))) {
    out.fit = opts.fit;
  }
  if (opts.format) out.format = opts.format;
  const quality = toPositiveInt(opts.quality);
  if (quality) out.quality = Math.min(quality, 100);
  return out;
}

function serializeTransformOptions(opts: TransformOptions): string {
  const parts: string[] = [];
  if (opts.width) parts.push(`width=${opts.width}`);
  if (opts.height) parts.push(`height=${opts.height}`);
  if (opts.fit) parts.push(`fit=${opts.fit}`);
  if (opts.format) parts.push(`format=${opts.format}`);
  if (opts.quality) parts.push(`quality=${opts.quality}`);
  return parts.join(',');
}

/**
 * Construye la URL final para una `key` (ya con extensión) bajo `base`.
 *
 * - Sin opciones, o si la key no es una imagen (vídeo, pdf): `${base}/${key}`.
 * - Con opciones: `${base}/cdn-cgi/image/<opciones>,onerror=redirect/${key}`,
 *   que es la única interfaz de URL de Cloudflare Image Transformations
 *   (los query params no se interpretan). `onerror=redirect` devuelve el
 *   original si la transformación falla o se agota la cuota del plan, en vez
 *   de una imagen rota.
 */
export function buildAssetUrl(base: string, key: string, opts?: TransformOptions): string {
  const normalized = normalizeTransformOptions(opts);
  const serialized = serializeTransformOptions(normalized);
  if (!serialized || !IMAGE_EXTENSIONS.has(extensionOf(key))) {
    return `${base}/${key}`;
  }
  return `${base}${TRANSFORM_PREFIX}${serialized},onerror=redirect/${key}`;
}

const OPTION_ALIASES: Record<string, keyof TransformOptions> = {
  width: 'width', w: 'width',
  height: 'height', h: 'height',
  fit: 'fit',
  format: 'format', f: 'format',
  quality: 'quality', q: 'quality',
};

function parseOptionPairs(pairs: Iterable<[string, string]>): TransformOptions {
  const raw: TransformOptions = {};
  for (const [k, v] of pairs) {
    const name = OPTION_ALIASES[k];
    if (!name) continue; // onerror, dpr, key... se descartan
    if (name === 'width' || name === 'height' || name === 'quality') {
      raw[name] = toPositiveInt(v);
    } else {
      raw[name] = v;
    }
  }
  return normalizeTransformOptions(raw);
}

/**
 * Descompone una URL de assets en `{ base, key, opts }`. Reconoce:
 * - `${base}/cdn-cgi/image/<opts>/<key>` (formato actual),
 * - `${base}/<key>?width=…` (formato legacy por query params),
 * - `${base}/<key>` (sin transformación).
 * Devuelve `null` si `url` no es absoluta.
 */
export function parseAssetUrl(url: string): ParsedAssetUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const base = parsed.origin;
  let path = parsed.pathname.replace(/^\/+/, '');
  let opts: TransformOptions = {};

  if (parsed.pathname.startsWith(TRANSFORM_PREFIX)) {
    const rest = parsed.pathname.slice(TRANSFORM_PREFIX.length);
    const slash = rest.indexOf('/');
    if (slash > -1) {
      const optionSegment = rest.slice(0, slash);
      path = rest.slice(slash + 1).replace(/^\/+/, '');
      opts = parseOptionPairs(
        optionSegment
          .split(',')
          .map((pair): [string, string] => {
            const eq = pair.indexOf('=');
            return eq > -1 ? [pair.slice(0, eq), pair.slice(eq + 1)] : [pair, ''];
          }),
      );
    }
  } else if (parsed.search) {
    opts = parseOptionPairs(parsed.searchParams.entries());
  }

  return { base, key: decodeURIComponent(path), opts };
}

/**
 * Construye una URL de asset servida desde Cloudflare R2 (`assets.kengoapp.com`).
 *
 * Patrón de keys en R2:
 * - Imágenes (portadas, avatares, logos): `<uuid>.webp`
 * - Vídeos: `<uuid>.mp4`
 *
 * Con opciones de transformación (`width`, `height`, `fit`, `format`,
 * `quality`) la URL usa la ruta `/cdn-cgi/image/<opciones>/<key>` de
 * Cloudflare Image Transformations; el proxy de respaldo `apps/media` acepta
 * el mismo contrato. Los vídeos nunca se transforman.
 *
 * La base sale de `assetsBase()` (signal): normalmente `ASSETS_URL`, y
 * `ASSETS_FALLBACK_URL` cuando `AssetHostService` detecta que Cloudflare está
 * bloqueado por el operador. Al ser un signal, los templates que llaman a esta
 * función se re-renderizan solos al conmutar.
 */
export function assetUrl(
  key: string | number | undefined | null,
  opts?: AssetUrlOptions,
): string {
  if (key === null || key === undefined || key === '') return '';

  const base = assetsBase();
  const keyWithExt = ensureExtension(String(key), opts?.extension ?? 'webp');
  return buildAssetUrl(base, keyWithExt, opts);
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
