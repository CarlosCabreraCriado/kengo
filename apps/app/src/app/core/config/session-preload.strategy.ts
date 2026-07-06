import { inject, Injectable } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { PreloadingStrategy, Route } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';
import { filter, switchMap, take } from 'rxjs/operators';
import { SessionService } from '../auth/services/session.service';
import { NetworkService } from '../services/network.service';

/** Etiqueta de precarga declarada en `data.preload` de cada ruta. */
export type PreloadTag = 'fisio' | 'paciente' | true;

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Estrategia de precarga por rol: descarga en idle los chunks de las
 * secciones que el usuario visitará con su rol actual, para que la primera
 * navegación a cada una sea instantánea (sin esperar red).
 *
 * Solo precarga rutas etiquetadas con `data: { preload: ... }`:
 * - 'fisio' / 'paciente' → solo si el modo activo coincide
 * - true → para ambos roles
 *
 * Se espera a que la sesión esté inicializada (el rol se deriva de la clínica
 * activa) y se aborta si el usuario pidió ahorro de datos, la conexión es
 * lenta (2g) o no hay red. La descarga se difiere a requestIdleCallback para
 * no competir con el trabajo de arranque.
 */
@Injectable({ providedIn: 'root' })
export class SessionPreloadStrategy implements PreloadingStrategy {
  private readonly session = inject(SessionService);
  private readonly network = inject(NetworkService);

  private readonly sesionLista$ = toObservable(this.session.sesionInicializada);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const tag = route.data?.['preload'] as PreloadTag | undefined;
    if (!tag) return EMPTY;

    return this.sesionLista$.pipe(
      filter(Boolean),
      take(1),
      switchMap(() => {
        if (!this.debePrecargar(tag)) return EMPTY;
        return this.enIdle$().pipe(switchMap(load));
      }),
    );
  }

  private debePrecargar(tag: PreloadTag): boolean {
    if (!this.session.isLoggedIn()) return false;
    if (!this.network.online()) return false;
    if (this.redLenta()) return false;
    if (tag === true) return true;
    if (tag === 'fisio') return this.session.enModoFisio();
    return this.session.enModoPaciente();
  }

  private redLenta(): boolean {
    const conn = (navigator as Navigator & { connection?: NetworkInformationLike })
      .connection;
    if (!conn) return false;
    return conn.saveData === true || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
  }

  /** Emite (y completa) cuando el navegador está en idle, con techo de 3s. */
  private enIdle$(): Observable<void> {
    return new Observable<void>((subscriber) => {
      const emitir = () => {
        subscriber.next();
        subscriber.complete();
      };
      if ('requestIdleCallback' in window) {
        const id = window.requestIdleCallback(emitir, { timeout: 3000 });
        return () => window.cancelIdleCallback(id);
      }
      const id = setTimeout(emitir, 1500);
      return () => clearTimeout(id);
    }).pipe(take(1));
  }
}
