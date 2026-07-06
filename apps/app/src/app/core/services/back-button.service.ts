import { inject, Injectable, NgZone } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import { DialogService } from '../../shared/services/dialog/dialog.service';
import { LoggerService } from './logger.service';
import { PlatformService } from './platform.service';

/**
 * Overlays que no pasan por DialogService (drawer del carrito, menús inline)
 * pueden registrar un handler para interceptar el botón atrás de Android.
 * `handleBack()` devuelve true si consumió el evento (cerró algo).
 */
export interface BackHandler {
  handleBack(): boolean;
}

/**
 * Botón atrás hardware de Android. Sin este listener, Capacitor aplica su
 * default (history.back o salir), que ignora los overlays de la SPA.
 *
 * Prioridad: handler registrado (drawer/menú abierto) → diálogo CDK abierto
 * (se cierra con su animación) → navegación atrás → en ruta raíz, minimizar
 * la app (patrón Android moderno: preserva el estado, no mata el proceso).
 *
 * Solo se registra en Android; AppComponent lo inyecta en el arranque nativo.
 */
@Injectable({ providedIn: 'root' })
export class BackButtonService {
  private readonly platform = inject(PlatformService);
  private readonly ngZone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly dialogService = inject(DialogService);
  private readonly logger = inject(LoggerService);

  private readonly handlers: BackHandler[] = [];

  /**
   * Rutas donde "atrás" ya no navega: son el home de cada contexto. En ellas
   * el botón atrás minimiza la app.
   */
  private readonly rutasRaiz = new Set([
    '/inicio',
    '/login',
    '/mi-plan',
    '/onboarding',
    '/seleccionar-clinica',
  ]);

  init(): void {
    if (!this.platform.isAndroid()) return;

    void CapacitorApp.addListener('backButton', () => {
      this.ngZone.run(() => this.onBack());
    });
  }

  /** Registro LIFO para overlays fuera de DialogService. */
  register(handler: BackHandler): void {
    this.handlers.push(handler);
  }

  unregister(handler: BackHandler): void {
    const idx = this.handlers.indexOf(handler);
    if (idx !== -1) this.handlers.splice(idx, 1);
  }

  private onBack(): void {
    // 1. Overlays custom registrados (último en abrirse, primero en cerrarse)
    for (let i = this.handlers.length - 1; i >= 0; i--) {
      if (this.handlers[i].handleBack()) return;
    }

    // 2. Diálogos/sheets CDK
    if (this.dialogService.hasOpenDialogs) {
      this.dialogService.closeTop();
      return;
    }

    // 3. Ruta raíz → background sin matar la app
    const path = this.router.url.split('?')[0];
    if (this.rutasRaiz.has(path)) {
      void CapacitorApp.minimizeApp().catch((err) =>
        this.logger.warn('[BackButton] minimizeApp falló:', err),
      );
      return;
    }

    // 4. Navegación normal
    this.location.back();
  }
}
