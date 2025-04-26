import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

//Peticiones HTTP:
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AuthInterceptorService } from './services/auth-interceptor.service';

import { MAT_DATE_LOCALE } from '@angular/material/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([AuthInterceptorService])),
    provideAnimationsAsync(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-ES' },
  ],
};
