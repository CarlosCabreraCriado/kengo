import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { environment as env } from '../../../../environments/environment';

/**
 * Interceptor que añade withCredentials a todas las peticiones
 * a nuestros dominios (Directus y API/BFF)
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  // Verificar si la petición es a nuestros dominios
  const isOurDomain =
    req.url.startsWith(env.DIRECTUS_URL) || req.url.startsWith(env.API_URL);

  if (isOurDomain) {
    // Añadir withCredentials para enviar cookies
    req = req.clone({ withCredentials: true });
  }

  return next(req);
};
