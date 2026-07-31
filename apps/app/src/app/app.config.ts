import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withPreloading } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { IMAGE_LOADER } from '@angular/common';

// Core imports
import { CustomRouteReuseStrategy, provideConvex } from './core';
import { SessionPreloadStrategy } from './core/config/session-preload.strategy';
import { isCapacitorNativePlatform } from './core/services/platform.service';
import { kengoImageLoader } from './core/utils/image-loader';
import { SESSION_RESETTABLES } from './core/auth/session-resettable';
import { BadgeSyncService } from './core/services/badge-sync.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { MensajesService } from './features/mensajes/data-access/mensajes.service';
import { PlanBuilderService } from './features/planes/data-access/plan-builder.service';
import { RutinaBuilderService } from './features/rutinas/data-access/rutina-builder.service';
import { ToastService } from './shared/services/toast/toast.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withPreloading(SessionPreloadStrategy)),
    provideHttpClient(withFetch()),
    provideAnimationsAsync(), // Still needed for CDK animations
    { provide: RouteReuseStrategy, useClass: CustomRouteReuseStrategy },
    { provide: IMAGE_LOADER, useValue: kengoImageLoader },
    ...provideConvex(),
    provideServiceWorker('ngsw-worker.js', {
      // Deshabilitado en native: el SW interfiere con WKWebView (capacitor://) y
      // el bridge nativo. La caché en native la gestiona el packager.
      enabled: !isDevMode() && !isCapacitorNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    // Servicios singleton que mantienen estado de sesión y deben purgarse
    // al hacer logout (SessionService.limpiar() recorre el multi-provide).
    { provide: SESSION_RESETTABLES, useExisting: PlanBuilderService, multi: true },
    { provide: SESSION_RESETTABLES, useExisting: RutinaBuilderService, multi: true },
    // Los toasts pendientes del usuario anterior no deben sobrevivir al logout.
    { provide: SESSION_RESETTABLES, useExisting: ToastService, multi: true },
    // La conversación seleccionada y la búsqueda no deben sobrevivir al
    // logout: alimentan el effect de markAsRead del chat.
    { provide: SESSION_RESETTABLES, useExisting: MensajesService, multi: true },
    // Push/badge: cubre cierres de sesión que no pasan por AuthService.logout
    // (sesión zombie en el arranque). En el logout normal duplica parte del
    // teardown; todo idempotente.
    { provide: SESSION_RESETTABLES, useExisting: PushNotificationService, multi: true },
    { provide: SESSION_RESETTABLES, useExisting: BadgeSyncService, multi: true },
  ],
};
