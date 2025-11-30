import { Injectable } from '@angular/core';
import {
  RouteReuseStrategy,
  ActivatedRouteSnapshot,
  DetachedRouteHandle,
} from '@angular/router';

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
  // Almacén de rutas cacheadas con su posición de scroll
  private cache = new Map<string, CachedRoute>();

  // Almacén de posiciones de scroll actuales (se actualiza continuamente)
  private scrollPositions = new Map<string, number>();

  // Ruta actualmente activa
  private currentRoute: string | null = null;

  // Rutas que queremos cachear (mantener su estado)
  private readonly routesToCache = new Set<string>([
    'ejercicios',
  ]);

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
    const path = route.routeConfig?.path;
    return path ?? '';
  }

  /**
   * Determina si esta ruta debe ser cacheada al salir
   */
  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const key = this.getRouteKey(route);
    return this.routesToCache.has(key);
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
    const key = this.getRouteKey(route);
    return this.cache.has(key);
  }

  /**
   * Recupera la ruta del caché y programa la restauración del scroll
   */
  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
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
   * Método para limpiar el caché manualmente si es necesario
   */
  clearCache(): void {
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
