import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Modo de render explícito para todas las rutas: prerender a HTML estático.
 *
 * El extractor de Angular ya descubre las rutas estáticas del router aunque
 * no se declare nada, pero dejarlo explícito evita que una ruta futura con
 * parámetros pase a modo cliente sin que nadie se dé cuenta — y con ello que
 * un buscador (o un revisor de App Store) reciba un HTML vacío.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
