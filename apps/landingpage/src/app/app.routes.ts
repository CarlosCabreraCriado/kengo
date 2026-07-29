import { Route } from '@angular/router';

/**
 * Todas las rutas son estáticas y se prerenderizan (`outputMode: "static"`).
 *
 * Importante: el comodín `**` debe seguir siendo **la última** entrada. Antes
 * era la segunda y absorbía cualquier URL, de modo que `/legal/privacidad`
 * devolvía silenciosamente la portada — justo el comportamiento que Apple
 * rechaza al revisar la Privacy Policy URL.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'legal',
    redirectTo: 'legal/privacidad',
    pathMatch: 'full',
  },
  {
    path: 'legal/privacidad',
    loadComponent: () =>
      import('./pages/legal/privacidad/legal-privacidad-page.component').then(
        (m) => m.LegalPrivacidadPageComponent,
      ),
  },
  {
    path: 'legal/terminos',
    loadComponent: () =>
      import('./pages/legal/terminos/legal-terminos-page.component').then(
        (m) => m.LegalTerminosPageComponent,
      ),
  },
  {
    path: 'legal/cookies',
    loadComponent: () =>
      import('./pages/legal/cookies/legal-cookies-page.component').then(
        (m) => m.LegalCookiesPageComponent,
      ),
  },
  {
    path: 'legal/aviso-legal',
    loadComponent: () =>
      import('./pages/legal/aviso-legal/legal-aviso-legal-page.component').then(
        (m) => m.LegalAvisoLegalPageComponent,
      ),
  },
  {
    // Support URL declarada en App Store Connect y Play Console.
    path: 'soporte',
    loadComponent: () =>
      import('./pages/soporte/soporte-page.component').then(
        (m) => m.SoportePageComponent,
      ),
  },
  {
    // URL de solicitud de borrado exigida por el formulario de Data Safety
    // de Google Play (debe ser accesible sin instalar la app).
    path: 'eliminar-cuenta',
    loadComponent: () =>
      import('./pages/eliminar-cuenta/eliminar-cuenta-page.component').then(
        (m) => m.EliminarCuentaPageComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
