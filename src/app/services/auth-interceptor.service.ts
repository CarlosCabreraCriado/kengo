/*
import {
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
  HttpInterceptor,
} from '@angular/common/http';
import { AuthService} from './auth.service';

import { Observable } from 'rxjs';

export const AuthInterceptorService: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {

  const token = localStorage.getItem('access_token');
  if (token) {
    const clonedRequest = req.clone({
      headers: req.headers.set('Authorization', 'Bearer ' + token),
    });
    return next(clonedRequest);
  } else {
    return next(req);
  }
};
*/

import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { defer, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

let refreshInFlight: Promise<void> | null = null;
const ensureRefreshed = (auth: AuthService) => {
  if (!refreshInFlight) {
    refreshInFlight = auth.refresh().finally(() => (refreshInFlight = null));
  }
  return refreshInFlight;
};

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const auth = inject(AuthService);
  const isAuthCall = /\/auth\/(login|refresh|logout)$/.test(req.url);

  const addAuthHeader = (r: HttpRequest<unknown>) => {
    const token = auth.accessToken();
    return token
      ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : r;
  };

  return defer(async () => {
    if (!isAuthCall && auth.isAccessTokenExpiredSoon()) {
      await ensureRefreshed(auth);
    }
    return addAuthHeader(req);
  }).pipe(
    switchMap((prepared) => next(prepared)),
    catchError((err) => {
      if (
        !isAuthCall &&
        err instanceof HttpErrorResponse &&
        err.status === 401
      ) {
        return from(ensureRefreshed(auth)).pipe(
          switchMap(() => next(addAuthHeader(req))),
          catchError((refreshErr) => {
            auth.clearTokens();
            return throwError(() => refreshErr);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
