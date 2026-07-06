import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { GuardsCheckEnd, NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
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
 * `GuardsCheckEnd` (guards resueltos, la navegación sigue adelante) el
 * overlay aparece antes de que el componente destino monte y se registre,
 * y se libera tras `NavigationEnd` con un pequeño grace period para que la
 * página tenga tiempo de registrarse. No se usa `NavigationStart` a
 * propósito: se emite antes de los `canDeactivate`, y cubriría la página
 * con el overlay mientras un guard asíncrono (p.ej. el diálogo de "cambios
 * sin guardar") todavía puede cancelar la navegación → flicker.
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
            e instanceof GuardsCheckEnd ||
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel ||
            e instanceof NavigationError,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        if (event instanceof GuardsCheckEnd) {
          // Mostrar overlay cuando los guards ya han aprobado la navegación
          // (si un canDeactivate la cancela, shouldActivate llega en false y
          // no se muestra nada). Si nadie se registra en 350 ms, lo
          // liberamos (la página probablemente no usa el patrón). Si alguien
          // se registra antes, su signal toma el control y `forced` se
          // libera al primer tick.
          if (event.shouldActivate) this.forceShow(350);
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
   * Vacía el registry completo y libera `forced`. Red de seguridad para flows
   * destructivos (logout): si un componente quedó registrado por una vía no
   * estándar (cache de RouteReuseStrategy, effects con ciclo de vida raro),
   * esto garantiza que el overlay no quede colgado tras logout.
   */
  clearRegistry(): void {
    this.registry.set(new Map());
    this.releaseForce();
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
