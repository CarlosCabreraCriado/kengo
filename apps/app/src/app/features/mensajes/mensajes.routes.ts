import { Routes } from '@angular/router';
import { AuthGuard } from '../../core';

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
        loadComponent: () =>
          import('./pages/mensajes-thread-page/mensajes-thread-page.component').then(
            (m) => m.MensajesThreadPageComponent,
          ),
      },
    ],
  },
];
