/**
 * @kengo/legal
 *
 * Fuente única de los textos legales de Kengo. Expone los cuatro documentos
 * como componentes standalone de **contenido puro**: solo markup semántico,
 * sin dependencias del catálogo `ui-v2`, del router ni de ningún servicio.
 *
 * Cada app decide el contenedor:
 *  - `apps/app` los pinta dentro de un diálogo (`LegalDialogComponent`) y de
 *    una página pública (`features/legal`).
 *  - `apps/landingpage` los prerenderiza como páginas estáticas (`/legal/*`).
 *
 * Así el texto jurídico vive en un único sitio y no puede divergir entre la
 * aplicación y la web.
 */

export * from './lib/legal-docs.metadata';
export * from './lib/privacidad/legal-privacidad.component';
export * from './lib/terminos/legal-terminos.component';
export * from './lib/cookies/legal-cookies.component';
export * from './lib/aviso-legal/legal-aviso-legal.component';
