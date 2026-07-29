import { Routes } from '@angular/router';
import { LEGAL_DOC_ORDER } from '@kengo/legal';

/**
 * Rutas legales públicas.
 *
 * **Sin guards a propósito.** Apple y Google revisan la política de
 * privacidad abriendo la URL desde un navegador, sin iniciar sesión; si estas
 * rutas exigieran sesión, el revisor vería la pantalla de login y la ficha
 * sería rechazada. No exponen ningún dato del usuario: son texto estático.
 *
 * Los documentos se comparten con la landing desde `@kengo/legal`, de modo
 * que `kengoapp.com/legal/privacidad` y `www.kengoapp.com/legal/privacidad`
 * muestran exactamente el mismo texto.
 */
export const LEGAL_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'privacidad',
    pathMatch: 'full',
  },
  ...LEGAL_DOC_ORDER.map((doc) => ({
    path: doc,
    data: { doc },
    loadComponent: () =>
      import('./pages/legal-doc/legal-doc.component').then(
        (m) => m.LegalDocComponent,
      ),
  })),
];
