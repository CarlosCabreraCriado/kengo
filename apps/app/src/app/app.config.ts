import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideHttpClient,
  withInterceptors,
  withFetch,
} from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

// Core imports
import { authInterceptor, CustomRouteReuseStrategy } from './core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(), // Still needed for CDK animations
    { provide: RouteReuseStrategy, useClass: CustomRouteReuseStrategy },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ],
};
