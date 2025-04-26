import {
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
  HttpInterceptorFn,
} from '@angular/common/http';

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
