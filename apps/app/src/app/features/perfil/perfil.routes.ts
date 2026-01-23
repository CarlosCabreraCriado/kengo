import { Routes } from '@angular/router';
import { AuthGuard } from '../../core';

export const PERFIL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/perfil/perfil.component').then((m) => m.PerfilComponent),
    canActivate: [AuthGuard],
  },
];
