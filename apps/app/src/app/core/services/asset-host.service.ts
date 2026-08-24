import { computed, DestroyRef, effect, inject, Injectable, Injector } from '@angular/core';
import {
  ASSETS_FALLBACK_BASE,
  ASSETS_PRIMARY_BASE,
  assetsBase,
  setAssetsBase,
} from '../utils/asset-host.store';
import { LoggerService } from './logger.service';
import { NetworkService } from './network.service';

/**
 * Decide desde qué host se sirven los assets (R2).
 *
 * Contexto: durante los partidos de LaLiga los operadores españoles bloquean
 * por IP el proxy de Cloudflare y `assets.kengoapp.com` (dominio custom de
 * R2, siempre proxied) deja de cargar aunque el resto de la app (Convex en
 * Railway) funcione. Este servicio sondea el host primario y, si no responde
 * con red disponible, conmuta a `ASSETS_FALLBACK_URL` (proxy en Railway). Cada
 * `RECHECK_MS` vuelve a sondear para regresar al CDN en cuanto acabe el
 * bloqueo, y también al recuperar la red o al volver del background.
 *
 * La sonda usa `mode: 'no-cors'`: nos interesa la alcanzabilidad de la IP,
 * no el status. Un 404 opaco resuelve (host alcanzable); un black hole del
 * operador (Movistar) agota el timeout y un aviso interceptado (Digi) falla
 * el TLS, y ambos rechazan → fallback.
 */
@Injectable({ providedIn: 'root' })
export class AssetHostService {
  private readonly network = inject(NetworkService);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  static readonly PROBE_TIMEOUT_MS = 3000;
  static readonly RECHECK_MS = 5 * 60 * 1000;
  private static readonly PROBE_PATH = '/health.txt';

  /** Base activa (reactiva). */
  readonly base = assetsBase;
  /** true mientras se sirve desde el proxy de Railway. */
  readonly fallbackActivo = computed(() => assetsBase() === ASSETS_FALLBACK_BASE);

  private recheckTimer: ReturnType<typeof setInterval> | null = null;
  private probing: Promise<void> | null = null;

  /**
   * Arranca la primera sonda (no bloqueante) y la re-sonda periódica. Se
   * registra desde `app.config.ts` vía `provideAppInitializer`.
   */
  init(): void {
    void this.probe();
    this.recheckTimer = setInterval(() => void this.probe(), AssetHostService.RECHECK_MS);
    this.destroyRef.onDestroy(() => {
      if (this.recheckTimer) clearInterval(this.recheckTimer);
    });

    // Al recuperar la red, re-evaluar: puede que el bloqueo haya terminado o
    // que hayamos cambiado de wifi (otro operador) a datos móviles.
    effect(
      () => {
        if (this.network.online()) void this.probe();
      },
      { injector: this.injector },
    );
  }

  /**
   * Sondea el host primario y fija la base. Idempotente y con dedupe: si ya
   * hay una sonda en vuelo se reutiliza.
   */
  probe(): Promise<void> {
    if (this.probing) return this.probing;
    this.probing = this.doProbe().finally(() => {
      this.probing = null;
    });
    return this.probing;
  }

  /**
   * Llamar cuando un `<img>`/`<video>` falla al cargar desde el host
   * primario con red disponible: adelanta la re-sonda sin esperar al timer.
   */
  reportFailure(): void {
    if (!this.fallbackActivo() && this.network.online()) void this.probe();
  }

  private async doProbe(): Promise<void> {
    // Sin red no hay nada que decidir; la sonda fallaría por motivos ajenos
    // al bloqueo y activaría el fallback sin sentido.
    if (!this.network.online()) return;

    const primaryOk = await this.reachable(ASSETS_PRIMARY_BASE);
    if (primaryOk) {
      if (this.fallbackActivo()) this.logger.info('[AssetHost] assets primario recuperado; volviendo al CDN');
      setAssetsBase(ASSETS_PRIMARY_BASE);
      return;
    }

    // Antes de conmutar, comprobar que el fallback sí responde: si tampoco
    // lo hace, el problema es de red general y cambiar de host no ayuda.
    const fallbackOk = await this.reachable(ASSETS_FALLBACK_BASE);
    if (fallbackOk) {
      if (!this.fallbackActivo()) {
        this.logger.warn('[AssetHost] assets primario inalcanzable; usando proxy de Railway');
      }
      setAssetsBase(ASSETS_FALLBACK_BASE);
    }
  }

  private async reachable(base: string): Promise<boolean> {
    try {
      await fetch(`${base}${AssetHostService.PROBE_PATH}?t=${Date.now()}`, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(AssetHostService.PROBE_TIMEOUT_MS),
      });
      return true;
    } catch {
      return false;
    }
  }
}
