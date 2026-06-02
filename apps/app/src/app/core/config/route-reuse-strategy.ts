import { Injectable, inject } from '@angular/core';
import {
  RouteReuseStrategy,
  ActivatedRouteSnapshot,
  DetachedRouteHandle,
} from '@angular/router';
import { LoggerService } from '../services/logger.service';

interface CachedRoute {
  handle: DetachedRouteHandle;
  scrollPosition: number;
}

/**
 * Estrategia personalizada de reutilización de rutas.
 * Permite cachear componentes específicos para mantener su estado
 * cuando el usuario navega fuera y vuelve a ellos.
 * También guarda y restaura la posición del scroll.
 */
@Injectable({ providedIn: 'root' })
export class CustomRouteReuseStrategy implements RouteReuseStrategy {
  private logger = inject(LoggerService);

  // Almacén de rutas cacheadas con su posición de scroll
  private cache = new Map<string, CachedRoute>();

  // Almacén de posiciones de scroll actuales (se actualiza continuamente)
  private scrollPositions = new Map<string, number>();

  // Ruta actualmente activa
  private currentRoute: string | null = null;

  // Rutas que queremos cachear (mantener su estado)
  private readonly routesToCache = new Set<string>([
    'inicio/fisio',
    'inicio/paciente',
    'ejercicios',
    'mis-pacientes',
    'mi-clinica',
  ]);

  // Permite desactivar el caché desde fuera (p. ej. durante logout). Cuando es
  // false, shouldDetach devuelve false para todas las rutas → el componente
  // saliente se destruye normalmente y su ngOnDestroy se ejecuta. Sin esto,
  // el componente activo en logout se "detach" y sus registros en servicios
  // singleton (PageLoaderService) quedan colgados como zombies.
  private cachingEnabled = true;

  constructor() {
    // Escuchar el evento scroll para guardar la posición continuamente
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', () => {
        if (this.currentRoute && this.routesToCache.has(this.currentRoute)) {
          this.scrollPositions.set(this.currentRoute, window.scrollY);
        }
      }, { passive: true });
    }
  }

  /**
   * Genera una clave única para identificar la ruta
   */
  private getRouteKey(route: ActivatedRouteSnapshot): string {
    return route.pathFromRoot
      .filter(r => r.routeConfig?.path && r.routeConfig.path.length > 0)
      .map(r => r.routeConfig!.path!)
      .join('/');
  }

  /**
   * Verifica si la ruta tiene un componente real (no es un wrapper componentless con loadChildren)
   */
  private hasComponent(route: ActivatedRouteSnapshot): boolean {
    return !!(route.routeConfig?.component || route.routeConfig?.loadComponent);
  }

  /**
   * Determina si esta ruta debe ser cacheada al salir
   */
  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    if (!this.cachingEnabled) return false;
    if (!this.hasComponent(route)) return false;
    const key = this.getRouteKey(route);
    return this.routesToCache.has(key);
  }

  /**
   * Activa/desactiva el caché de rutas. Llamado por AuthService:
   * - false en logout (antes de navegar a /login)
   * - true cuando hay sesión válida (login, consumirToken, iniciarApp con éxito)
   */
  setCachingEnabled(enabled: boolean): void {
    this.cachingEnabled = enabled;
  }

  /**
   * Almacena la ruta en el caché junto con la posición del scroll guardada
   */
  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.getRouteKey(route);
    if (handle && this.routesToCache.has(key)) {
      // Usar la posición guardada del scroll (más confiable que window.scrollY en este momento)
      const savedScrollPosition = this.scrollPositions.get(key) ?? 0;
      this.cache.set(key, {
        handle,
        scrollPosition: savedScrollPosition,
      });
    }
  }

  /**
   * Determina si debemos restaurar una ruta cacheada
   */
  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    if (!this.hasComponent(route)) return false;
    const key = this.getRouteKey(route);
    return this.cache.has(key);
  }

  /**
   * Recupera la ruta del caché y programa la restauración del scroll
   */
  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    if (!this.hasComponent(route)) return null;
    const key = this.getRouteKey(route);
    const cached = this.cache.get(key);

    if (cached) {
      // Restaurar la posición del scroll después de que el componente se renderice
      // Usamos requestAnimationFrame + setTimeout para asegurar que el DOM esté listo
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.scrollTo({
            top: cached.scrollPosition,
            behavior: 'instant'
          });
        }, 50);
      });

      return cached.handle;
    }

    return null;
  }

  /**
   * Determina si debe reutilizar la ruta actual
   * También actualiza la ruta activa para el tracking del scroll
   */
  shouldReuseRoute(
    future: ActivatedRouteSnapshot,
    curr: ActivatedRouteSnapshot
  ): boolean {
    // Actualizar la ruta actualmente activa
    const futureKey = this.getRouteKey(future);
    if (futureKey) {
      this.currentRoute = futureKey;
    }

    return future.routeConfig === curr.routeConfig;
  }

  /**
   * Método para limpiar el caché manualmente si es necesario.
   *
   * Destruye explícitamente el ComponentRef de cada handle cacheado para que
   * sus ngOnDestroy se ejecuten (importante: PageLoaderService.unregister,
   * cleanup de signals/effects). Sin esto, los componentes detached quedaban
   * vivos en memoria y sus registros singleton colgados.
   *
   * `DetachedRouteHandle` es opaque a nivel tipo, pero Angular Router lo
   * implementa internamente como `{ componentRef, route, contexts }`.
   */
  clearCache(): void {
    for (const cached of this.cache.values()) {
      const internal = cached.handle as unknown as {
        componentRef?: { destroy(): void };
      };
      try {
        internal.componentRef?.destroy();
      } catch (err) {
        this.logger.warn('[RouteReuseStrategy] destroy falló:', err);
      }
    }
    this.cache.clear();
    this.scrollPositions.clear();
  }

  /**
   * Método para limpiar una ruta específica del caché
   */
  clearRouteCache(routePath: string): void {
    this.cache.delete(routePath);
    this.scrollPositions.delete(routePath);
  }
}
