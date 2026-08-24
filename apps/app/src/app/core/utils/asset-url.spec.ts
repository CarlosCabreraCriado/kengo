import {
  ASSETS_FALLBACK_BASE,
  ASSETS_PRIMARY_BASE,
  isAssetsUrl,
  setAssetsBase,
} from './asset-host.store';
import {
  assetUrl,
  buildAssetUrl,
  parseAssetUrl,
  rawAssetUrl,
  thumbnailUrl,
  videoUrl,
} from './asset-url';
import { kengoImageLoader, snapWidth } from './image-loader';

describe('assetUrl + asset-host.store', () => {
  afterEach(() => setAssetsBase(ASSETS_PRIMARY_BASE));

  it('construye contra el CDN primario por defecto', () => {
    expect(assetUrl('planes/abc')).toBe(`${ASSETS_PRIMARY_BASE}/planes/abc.webp`);
    expect(videoUrl('videos/v1')).toBe(`${ASSETS_PRIMARY_BASE}/videos/v1.mp4`);
  });

  it('usa la ruta /cdn-cgi/image/ de Cloudflare cuando hay transformación', () => {
    expect(thumbnailUrl('planes/abc', 400, 300)).toBe(
      `${ASSETS_PRIMARY_BASE}/cdn-cgi/image/width=400,height=300,fit=cover,format=webp,onerror=redirect/planes/abc.webp`,
    );
    expect(assetUrl('abc', { width: 480, fit: 'cover', quality: 80 })).toBe(
      `${ASSETS_PRIMARY_BASE}/cdn-cgi/image/width=480,quality=80,onerror=redirect/abc.webp`,
    );
  });

  it('nunca transforma vídeos ni URLs sin opciones', () => {
    expect(rawAssetUrl('abc')).not.toContain('/cdn-cgi/');
    expect(videoUrl('v1')).not.toContain('/cdn-cgi/');
    expect(assetUrl('v1', { extension: 'mp4', width: 400 })).toBe(`${ASSETS_PRIMARY_BASE}/v1.mp4`);
    expect(assetUrl('abc', { key: 'avatar' })).toBe(`${ASSETS_PRIMARY_BASE}/abc.webp`);
  });

  it('omite fit=cover si falta una dimensión', () => {
    expect(assetUrl('abc', { fit: 'cover' })).toBe(`${ASSETS_PRIMARY_BASE}/abc.webp`);
    expect(buildAssetUrl('https://x', 'a.webp', { width: 100, fit: 'cover' })).toBe(
      'https://x/cdn-cgi/image/width=100,onerror=redirect/a.webp',
    );
    expect(buildAssetUrl('https://x', 'a.webp', { width: 100, fit: 'contain' })).toBe(
      'https://x/cdn-cgi/image/width=100,fit=contain,onerror=redirect/a.webp',
    );
  });

  it('conmuta a la base de respaldo sin tocar los callers', () => {
    setAssetsBase(ASSETS_FALLBACK_BASE);
    expect(thumbnailUrl('planes/abc', 400, 300)).toBe(
      `${ASSETS_FALLBACK_BASE}/cdn-cgi/image/width=400,height=300,fit=cover,format=webp,onerror=redirect/planes/abc.webp`,
    );
    setAssetsBase(ASSETS_PRIMARY_BASE);
    expect(assetUrl('planes/abc')).toBe(`${ASSETS_PRIMARY_BASE}/planes/abc.webp`);
  });

  it('isAssetsUrl reconoce ambas bases', () => {
    expect(isAssetsUrl(`${ASSETS_PRIMARY_BASE}/x.webp`)).toBeTrue();
    expect(isAssetsUrl(`${ASSETS_FALLBACK_BASE}/x.webp`)).toBeTrue();
    expect(isAssetsUrl('https://otro.example/x.webp')).toBeFalse();
  });
});

describe('parseAssetUrl', () => {
  it('descompone la ruta /cdn-cgi/image/', () => {
    const p = parseAssetUrl(
      'https://assets.kengoapp.com/cdn-cgi/image/width=400,height=300,fit=cover,format=webp,onerror=redirect/planes/abc.webp',
    );
    expect(p).toEqual({
      base: 'https://assets.kengoapp.com',
      key: 'planes/abc.webp',
      opts: { width: 400, height: 300, fit: 'cover', format: 'webp' },
    });
  });

  it('entiende el formato legacy por query params y alias cortos', () => {
    const p = parseAssetUrl('https://media.kengoapp.com/abc.webp?w=100&h=50&fit=cover&q=70&key=x');
    expect(p).toEqual({
      base: 'https://media.kengoapp.com',
      key: 'abc.webp',
      opts: { width: 100, height: 50, fit: 'cover', quality: 70 },
    });
  });

  it('devuelve opts vacías para URLs planas y null para relativas', () => {
    expect(parseAssetUrl('https://assets.kengoapp.com/abc.webp')).toEqual({
      base: 'https://assets.kengoapp.com',
      key: 'abc.webp',
      opts: {},
    });
    expect(parseAssetUrl('/assets/logo.svg')).toBeNull();
  });
});

describe('kengoImageLoader', () => {
  afterEach(() => setAssetsBase(ASSETS_PRIMARY_BASE));

  it('redondea la anchura a la escalera', () => {
    expect(snapWidth(1)).toBe(64);
    expect(snapWidth(64)).toBe(64);
    expect(snapWidth(96)).toBe(128);
    expect(snapWidth(800)).toBe(1024);
    expect(snapWidth(5000)).toBe(1920);
  });

  it('reescribe la ruta a partir de un src plano', () => {
    const out = kengoImageLoader({
      src: assetUrl('planes/abc'),
      width: 96,
      loaderParams: { fit: 'cover', quality: 80 },
    });
    expect(out).toBe(
      `${ASSETS_PRIMARY_BASE}/cdn-cgi/image/width=128,format=webp,quality=80,onerror=redirect/planes/abc.webp`,
    );
  });

  it('descarta width/height del src y aplica loaderParams', () => {
    const out = kengoImageLoader({
      src: assetUrl('planes/abc', { width: 200, height: 200, fit: 'cover', format: 'webp' }),
      width: 256,
      loaderParams: { fit: 'cover', height: 160, quality: 70 },
    });
    expect(out).toBe(
      `${ASSETS_PRIMARY_BASE}/cdn-cgi/image/width=256,height=160,fit=cover,format=webp,quality=70,onerror=redirect/planes/abc.webp`,
    );
  });

  it('sin width (modo fill) no emite anchura pero sí formato y calidad', () => {
    const out = kengoImageLoader({ src: assetUrl('abc') });
    expect(out).toBe(
      `${ASSETS_PRIMARY_BASE}/cdn-cgi/image/format=webp,quality=80,onerror=redirect/abc.webp`,
    );
  });

  it('reescribe params en la base de respaldo y desde URLs legacy', () => {
    setAssetsBase(ASSETS_FALLBACK_BASE);
    const out = kengoImageLoader({
      src: `${ASSETS_FALLBACK_BASE}/planes/abc.webp?width=100&fit=cover`,
      width: 800,
      loaderParams: { fit: 'cover', quality: 70 },
    });
    expect(out).toBe(
      `${ASSETS_FALLBACK_BASE}/cdn-cgi/image/width=1024,format=webp,quality=70,onerror=redirect/planes/abc.webp`,
    );
  });

  it('deja intactas URLs ajenas', () => {
    expect(kengoImageLoader({ src: '/assets/logo.svg' })).toBe('/assets/logo.svg');
  });
});
