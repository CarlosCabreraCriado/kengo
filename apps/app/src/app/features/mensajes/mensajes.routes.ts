import { Routes } from '@angular/router';
import { AuthGuard, clinicaActivaResourceGuard } from '../../core';

export const MENSAJES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/mensajes-shell/mensajes-shell.component').then(
        (m) => m.MensajesShellComponent,
      ),
    children: [
      {
        path: ':id',
        canActivate: [clinicaActivaResourceGuard('conversacion')],
        loadComponent: () =>
          import('./pages/mensajes-thread-page/mensajes-thread-page.component').then(
            (m) => m.MensajesThreadPageComponent,
          ),
      },
    ],
  },
];
