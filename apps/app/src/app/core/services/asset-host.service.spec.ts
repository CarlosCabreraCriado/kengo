import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ASSETS_FALLBACK_BASE,
  ASSETS_PRIMARY_BASE,
  setAssetsBase,
} from '../utils/asset-host.store';
import { AssetHostService } from './asset-host.service';
import { LoggerService } from './logger.service';
import { NetworkService } from './network.service';

describe('AssetHostService', () => {
  let online: ReturnType<typeof signal<boolean>>;
  let service: AssetHostService;
  let fetchSpy: jasmine.Spy;

  /** Mapa host → resuelve (true) o rechaza (false). */
  function mockFetch(reachable: Record<string, boolean>): void {
    fetchSpy = spyOn(window, 'fetch').and.callFake((input: RequestInfo | URL) => {
      const url = String(input);
      const host = Object.keys(reachable).find((h) => url.startsWith(h));
      if (host && reachable[host]) return Promise.resolve(new Response(null, { status: 404 }));
      return Promise.reject(new TypeError('Failed to fetch'));
    });
  }

  beforeEach(() => {
    online = signal(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: NetworkService, useValue: { online: online.asReadonly() } },
        { provide: LoggerService, useValue: { info: () => undefined, warn: () => undefined } },
      ],
    });
    setAssetsBase(ASSETS_PRIMARY_BASE);
    service = TestBed.inject(AssetHostService);
  });

  afterEach(() => setAssetsBase(ASSETS_PRIMARY_BASE));

  it('mantiene el CDN primario cuando responde', async () => {
    mockFetch({ [ASSETS_PRIMARY_BASE]: true, [ASSETS_FALLBACK_BASE]: true });
    await service.probe();
    expect(service.base()).toBe(ASSETS_PRIMARY_BASE);
    expect(service.fallbackActivo()).toBeFalse();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('conmuta al proxy de Railway cuando el primario no responde y el fallback sí', async () => {
    mockFetch({ [ASSETS_PRIMARY_BASE]: false, [ASSETS_FALLBACK_BASE]: true });
    await service.probe();
    expect(service.base()).toBe(ASSETS_FALLBACK_BASE);
    expect(service.fallbackActivo()).toBeTrue();
  });

  it('no conmuta si tampoco responde el fallback (fallo de red general)', async () => {
    mockFetch({ [ASSETS_PRIMARY_BASE]: false, [ASSETS_FALLBACK_BASE]: false });
    await service.probe();
    expect(service.base()).toBe(ASSETS_PRIMARY_BASE);
  });

  it('vuelve al primario en cuanto responde de nuevo', async () => {
    mockFetch({ [ASSETS_PRIMARY_BASE]: false, [ASSETS_FALLBACK_BASE]: true });
    await service.probe();
    expect(service.fallbackActivo()).toBeTrue();

    fetchSpy.and.callFake(() => Promise.resolve(new Response(null, { status: 404 })));
    await service.probe();
    expect(service.fallbackActivo()).toBeFalse();
  });

  it('no sondea sin red', async () => {
    online.set(false);
    mockFetch({ [ASSETS_PRIMARY_BASE]: false, [ASSETS_FALLBACK_BASE]: true });
    await service.probe();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(service.base()).toBe(ASSETS_PRIMARY_BASE);
  });

  it('deduplica sondas concurrentes', async () => {
    mockFetch({ [ASSETS_PRIMARY_BASE]: true });
    await Promise.all([service.probe(), service.probe(), service.probe()]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
