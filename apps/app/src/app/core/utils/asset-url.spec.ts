import {
  ASSETS_FALLBACK_BASE,
  ASSETS_PRIMARY_BASE,
  isAssetsUrl,
  setAssetsBase,
} from './asset-host.store';
import { assetUrl, thumbnailUrl, videoUrl } from './asset-url';
import { kengoImageLoader } from './image-loader';

describe('assetUrl + asset-host.store', () => {
  afterEach(() => setAssetsBase(ASSETS_PRIMARY_BASE));

  it('construye contra el CDN primario por defecto', () => {
    expect(assetUrl('planes/abc')).toBe(`${ASSETS_PRIMARY_BASE}/planes/abc.webp`);
    expect(videoUrl('videos/v1')).toBe(`${ASSETS_PRIMARY_BASE}/videos/v1.mp4`);
  });

  it('conmuta a la base de respaldo sin tocar los callers', () => {
    setAssetsBase(ASSETS_FALLBACK_BASE);
    expect(thumbnailUrl('planes/abc', 400, 300)).toBe(
      `${ASSETS_FALLBACK_BASE}/planes/abc.webp?width=400&height=300&fit=cover&format=webp`,
    );
    setAssetsBase(ASSETS_PRIMARY_BASE);
    expect(assetUrl('planes/abc')).toBe(`${ASSETS_PRIMARY_BASE}/planes/abc.webp`);
  });

  it('isAssetsUrl reconoce ambas bases', () => {
    expect(isAssetsUrl(`${ASSETS_PRIMARY_BASE}/x.webp`)).toBeTrue();
    expect(isAssetsUrl(`${ASSETS_FALLBACK_BASE}/x.webp`)).toBeTrue();
    expect(isAssetsUrl('https://otro.example/x.webp')).toBeFalse();
  });

  it('kengoImageLoader reescribe params en la base de respaldo', () => {
    setAssetsBase(ASSETS_FALLBACK_BASE);
    const out = kengoImageLoader({
      src: assetUrl('planes/abc', { width: 100 }),
      width: 800,
      loaderParams: { fit: 'cover', quality: 70 },
    });
    const url = new URL(out);
    expect(url.origin).toBe(new URL(ASSETS_FALLBACK_BASE).origin);
    expect(url.searchParams.get('width')).toBe('800');
    expect(url.searchParams.get('fit')).toBe('cover');
    expect(url.searchParams.get('quality')).toBe('70');
    expect(url.searchParams.get('format')).toBe('webp');
  });

  it('kengoImageLoader deja intactas URLs ajenas', () => {
    expect(kengoImageLoader({ src: '/assets/logo.svg' })).toBe('/assets/logo.svg');
  });
});
