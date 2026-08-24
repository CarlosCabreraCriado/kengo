/**
 * `media.kengoapp.com` — proxy de respaldo de Cloudflare R2 servido desde
 * Railway, SIN Cloudflare delante.
 *
 * Por qué existe: durante los partidos de LaLiga los operadores españoles
 * bloquean por IP el proxy de Cloudflare, y `assets.kengoapp.com` (dominio
 * custom de R2, que no admite "solo DNS") deja de cargar. La app sondea
 * `assets.` al arrancar y, si no responde, construye las URLs de imagen/vídeo
 * contra este servicio (ver `apps/app/src/app/core/services/asset-host.service.ts`).
 *
 * Contrato: el mismo que Cloudflare Image Transformations por query params
 * (`width`, `height`, `fit`, `format`, `quality`) que ya usan `asset-url.ts` e
 * `image-loader.ts`, para que las URLs sean intercambiables cambiando solo la
 * base. Los vídeos se sirven en streaming con soporte de `Range`.
 *
 * Env vars (las mismas que el deployment de Convex, ver convex/storage/r2Client.ts):
 *   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 * Opcionales: PORT (Railway), MEDIA_CACHE_MB (default 256), MEDIA_MAX_DIM (default 2048).
 */
const express = require('express');
const sharp = require('sharp');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const PORT = process.env.PORT || 4300;
const CACHE_MB = Number(process.env.MEDIA_CACHE_MB || 256);
const MAX_DIM = Number(process.env.MEDIA_MAX_DIM || 2048);
const R2_TIMEOUT_MS = 15_000;

const IMAGE_EXTENSIONS = new Set(['webp', 'jpg', 'jpeg', 'png', 'avif', 'gif']);
const PASSTHROUGH_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'pdf', 'txt']);
const OUTPUT_FORMATS = new Set(['webp', 'jpg', 'jpeg', 'png', 'avif']);
const FITS = new Set(['cover', 'contain', 'inside', 'outside']);

const CONTENT_TYPES = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  avif: 'image/avif',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
};

function r2Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey || !process.env.R2_BUCKET) {
    throw new Error(
      'R2 no configurado. Faltan env vars: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET',
    );
  }
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const s3 = r2Client();
const BUCKET = process.env.R2_BUCKET;

// ---------------------------------------------------------------------------
// Caché LRU en memoria acotada por bytes. Guarda originales de imagen y
// variantes transformadas; los vídeos nunca se cachean (se hacen streaming).
// Las keys de R2 son UUIDs inmutables, así que no hay invalidación.
// ---------------------------------------------------------------------------
class ByteLru {
  constructor(maxBytes) {
    this.maxBytes = maxBytes;
    this.size = 0;
    this.map = new Map();
  }
  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    // Refrescar orden de uso.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit;
  }
  set(key, entry) {
    const bytes = entry.body.length;
    if (bytes > this.maxBytes) return;
    if (this.map.has(key)) {
      this.size -= this.map.get(key).body.length;
      this.map.delete(key);
    }
    this.map.set(key, entry);
    this.size += bytes;
    while (this.size > this.maxBytes) {
      const oldest = this.map.keys().next().value;
      this.size -= this.map.get(oldest).body.length;
      this.map.delete(oldest);
    }
  }
}

const cache = new ByteLru(CACHE_MB * 1024 * 1024);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function extensionOf(key) {
  const dot = key.lastIndexOf('.');
  return dot > -1 ? key.slice(dot + 1).toLowerCase() : '';
}

/**
 * Valida la key: sin `..`, sin barra inicial, solo caracteres razonables y
 * extensión conocida. Devuelve null si no es aceptable.
 */
function sanitizeKey(raw) {
  const key = decodeURIComponent(raw).replace(/^\/+/, '');
  if (!key || key.length > 512) return null;
  if (key.includes('..') || key.includes('//')) return null;
  if (!/^[A-Za-z0-9_\-./]+$/.test(key)) return null;
  const ext = extensionOf(key);
  if (!IMAGE_EXTENSIONS.has(ext) && !PASSTHROUGH_EXTENSIONS.has(ext)) return null;
  return key;
}

function parseTransform(query) {
  const clampDim = (v) => {
    const n = Number.parseInt(String(v), 10);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.min(n, MAX_DIM);
  };
  const width = query.width ? clampDim(query.width) : undefined;
  const height = query.height ? clampDim(query.height) : undefined;
  const fit = FITS.has(String(query.fit)) ? String(query.fit) : undefined;
  const format = OUTPUT_FORMATS.has(String(query.format)) ? String(query.format) : undefined;
  let quality;
  if (query.quality !== undefined) {
    const q = Number.parseInt(String(query.quality), 10);
    if (Number.isFinite(q)) quality = Math.min(Math.max(q, 1), 100);
  }
  if (!width && !height && !fit && !format && quality === undefined) return null;
  return { width, height, fit, format, quality };
}

function transformCacheKey(key, t) {
  return `${key}|w=${t.width ?? ''}|h=${t.height ?? ''}|fit=${t.fit ?? ''}|f=${t.format ?? ''}|q=${t.quality ?? ''}`;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('R2 timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function getObject(key, range) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: range });
  return withTimeout(s3.send(cmd), R2_TIMEOUT_MS);
}

/** Original completo en memoria (solo imágenes; cacheado). */
async function getImageBuffer(key) {
  const cached = cache.get(key);
  if (cached) return cached;
  const obj = await getObject(key);
  const body = await streamToBuffer(obj.Body);
  const entry = {
    body,
    contentType: obj.ContentType || CONTENT_TYPES[extensionOf(key)] || 'application/octet-stream',
    etag: obj.ETag,
  };
  cache.set(key, entry);
  return entry;
}

async function getTransformed(key, t) {
  const ck = transformCacheKey(key, t);
  const cached = cache.get(ck);
  if (cached) return cached;

  const original = await getImageBuffer(key);
  let pipeline = sharp(original.body, { animated: false });
  if (t.width || t.height) {
    pipeline = pipeline.resize({
      width: t.width,
      height: t.height,
      fit: t.fit ?? 'cover',
      withoutEnlargement: true,
    });
  }
  const format = t.format === 'jpg' ? 'jpeg' : (t.format ?? extensionOf(key));
  const outExt = format === 'jpeg' ? 'jpg' : format;
  const quality = t.quality ?? 80;
  switch (format) {
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality });
      break;
    case 'png':
      pipeline = pipeline.png();
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality });
      break;
    default:
      // gif u otros: devolver el original sin recodificar.
      return original;
  }
  const body = await pipeline.toBuffer();
  const entry = {
    body,
    contentType: CONTENT_TYPES[outExt] || 'application/octet-stream',
    etag: original.etag ? `${original.etag.replace(/"$/, '')}-${Buffer.from(ck).toString('base64url').slice(0, 16)}"` : undefined,
  };
  cache.set(ck, entry);
  return entry;
}

function isNotFound(err) {
  return err && (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404);
}

function setCommonHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag, Accept-Ranges');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Kengo-Media', 'railway-fallback');
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');

app.get('/health', (req, res) => {
  res.status(200).type('text/plain').send('OK');
});

app.options('/{*splat}', (req, res) => {
  setCommonHeaders(res);
  res.status(204).end();
});

app.get('/{*splat}', async (req, res) => {
  const key = sanitizeKey(req.path);
  if (!key) {
    res.status(400).type('text/plain').send('Bad key');
    return;
  }
  const ext = extensionOf(key);
  setCommonHeaders(res);

  try {
    // Imágenes con transformación → sharp (en memoria, cacheado).
    if (IMAGE_EXTENSIONS.has(ext)) {
      const t = parseTransform(req.query);
      const entry = t ? await getTransformed(key, t) : await getImageBuffer(key);
      if (entry.etag) {
        res.setHeader('ETag', entry.etag);
        if (req.headers['if-none-match'] === entry.etag) {
          res.status(304).end();
          return;
        }
      }
      res.setHeader('Content-Type', entry.contentType);
      res.setHeader('Content-Length', String(entry.body.length));
      if (req.method === 'HEAD') {
        res.status(200).end();
        return;
      }
      res.status(200).end(entry.body);
      return;
    }

    // Vídeos / PDF / otros → streaming directo con soporte Range.
    const obj = await getObject(key, req.headers.range);
    res.setHeader('Content-Type', obj.ContentType || CONTENT_TYPES[ext] || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    if (obj.ETag) res.setHeader('ETag', obj.ETag);
    if (obj.ContentLength !== undefined) res.setHeader('Content-Length', String(obj.ContentLength));
    if (obj.ContentRange) {
      res.setHeader('Content-Range', obj.ContentRange);
      res.status(206);
    } else {
      res.status(200);
    }
    if (req.method === 'HEAD') {
      obj.Body?.destroy?.();
      res.end();
      return;
    }
    obj.Body.on('error', (err) => {
      console.error('[media] stream error', key, err.message);
      res.destroy(err);
    });
    req.on('close', () => obj.Body?.destroy?.());
    obj.Body.pipe(res);
  } catch (err) {
    if (isNotFound(err)) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    if (err?.$metadata?.httpStatusCode === 416) {
      res.status(416).end();
      return;
    }
    console.error('[media] error', key, err?.name, err?.message);
    res.status(502).type('text/plain').send('Upstream error');
  }
});

app.listen(PORT, () => {
  console.log(`Media fallback server running on port ${PORT} (cache ${CACHE_MB} MB, bucket ${BUCKET})`);
});
