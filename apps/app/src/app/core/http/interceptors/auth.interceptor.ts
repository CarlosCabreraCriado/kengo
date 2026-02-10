import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { from } from 'rxjs';
import { environment as env } from '../../../../environments/environment';
import { AuthService } from '../../auth/services/auth.service';

/** Endpoints de auth que NO deben disparar refresh (para evitar loops) */
const AUTH_PATHS = [
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/refrescar-sesion',
  '/auth/token-acceso',
  '/registro',
  '/auth/recuperar-password',
  '/auth/reset-password',
];

function isAuthEndpoint(url: string): boolean {
  return AUTH_PATHS.some((path) => url.includes(path));
}

function isOurDomain(url: string): boolean {
  return url.startsWith(env.DIRECTUS_URL) || url.startsWith(env.API_URL);
}

/**
 * Interceptor que:
 * 1. Añade withCredentials a peticiones a nuestros dominios
 * 2. Maneja 401 intentando refresh de sesión y reintentando la petición
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  // inject() DEBE estar en el nivel top del interceptor, dentro del injection context.
  // Si se pone dentro de catchError (callback asíncrono), lanza NG0203.
  const authService = inject(AuthService);

  if (!isOurDomain(req.url)) {
    return next(req);
  }

  // Añadir withCredentials para enviar cookies
  const authReq = req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint(req.url)) {
        return from(authService.handleRefresh()).pipe(
          switchMap((refreshed) => {
            if (refreshed) {
              return next(authReq);
            }
            authService.limpiarEstadoLocal();
            return throwError(() => error);
          }),
        );
      }

      return throwError(() => error);
    }),
  );
};
