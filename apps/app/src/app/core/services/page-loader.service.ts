import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

/**
 * Coordinador del overlay global de carga de página.
 *
 * Cada componente de ruta registra una signal `ready` (computed sobre sus
 * cargas críticas). Mientras al menos una entrada registrada esté en
 * `ready === false`, el overlay se muestra sobre el `<router-outlet>`.
 *
 * Además se gestiona un "force show" durante la transición de ruta: en
 * `NavigationStart` el overlay aparece inmediatamente (antes de que el
 * componente destino monte y se registre), y se libera tras `NavigationEnd`
 * con un pequeño grace period para que la página tenga tiempo de registrarse.
 */
@Injectable({ providedIn: 'root' })
export class PageLoaderService {
  private readonly router = inject(Router);

  /** Signals registradas por componentes activos. */
  private readonly registry = signal<Map<string, Signal<boolean>>>(new Map());

  /**
   * Flag que fuerza mostrar el overlay durante la transición de ruta antes
   * de que el componente destino haga `register`. Se libera por timeout o
   * cuando alguien se registra.
   */
  private readonly forced = signal(false);
  private forceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Si hay alguna entrada con ready=false, o estamos forzando overlay. */
  readonly isPageLoading = computed(() => {
    if (this.forced()) return true;
    const entries = this.registry();
    if (entries.size === 0) return false;
    for (const ready of entries.values()) {
      if (!ready()) return true;
    }
    return false;
  });

  constructor() {
    this.router.events
      .pipe(
        filter(
          (e) =>
            e instanceof NavigationStart ||
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel ||
            e instanceof NavigationError,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          // Mostrar overlay inmediatamente al iniciar navegación. Si nadie
          // se registra en 350 ms, lo liberamos (la página probablemente no
          // usa el patrón). Si alguien se registra antes, su signal toma el
          // control y `forced` se libera al primer tick.
          this.forceShow(350);
          return;
        }
        // En cualquier finalización (end/cancel/error), libera el force
        // tras un breve grace period para no parpadear.
        this.scheduleRelease(80);
      });
  }

  /** Registra el signal `ready` de una página. */
  register(key: string, ready: Signal<boolean>): void {
    const next = new Map(this.registry());
    next.set(key, ready);
    this.registry.set(next);
    // Si alguien ya se registró, podemos liberar el forced — su signal
    // controla la visibilidad.
    this.releaseForce();
  }

  /** Quita el registro al destruir la página. */
  unregister(key: string): void {
    const current = this.registry();
    if (!current.has(key)) return;
    const next = new Map(current);
    next.delete(key);
    this.registry.set(next);
  }

  /**
   * Fuerza mostrar el overlay durante `ms` (por defecto 250). Útil si una
   * acción imperativa (logout, refresh manual) quiere cubrir la UI sin
   * pasar por el ciclo de navegación.
   */
  forceShow(ms = 250): void {
    this.forced.set(true);
    if (this.forceTimer) clearTimeout(this.forceTimer);
    this.forceTimer = setTimeout(() => {
      this.forceTimer = null;
      this.forced.set(false);
    }, ms);
  }

  private scheduleRelease(ms: number): void {
    if (this.forceTimer) clearTimeout(this.forceTimer);
    this.forceTimer = setTimeout(() => {
      this.forceTimer = null;
      this.forced.set(false);
    }, ms);
  }

  private releaseForce(): void {
    if (this.forceTimer) {
      clearTimeout(this.forceTimer);
      this.forceTimer = null;
    }
    if (this.forced()) this.forced.set(false);
  }
}
