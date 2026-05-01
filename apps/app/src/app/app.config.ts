import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

// Core imports
import { CustomRouteReuseStrategy, provideConvex } from './core';
import { isCapacitorNativePlatform } from './core/services/platform.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideAnimationsAsync(), // Still needed for CDK animations
    { provide: RouteReuseStrategy, useClass: CustomRouteReuseStrategy },
    ...provideConvex(),
    provideServiceWorker('ngsw-worker.js', {
      // Deshabilitado en native: el SW interfiere con WKWebView (capacitor://) y
      // el bridge nativo. La caché en native la gestiona el packager.
      enabled: !isDevMode() && !isCapacitorNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ],
};
