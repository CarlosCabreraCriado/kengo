import { Routes } from '@angular/router';
import { AuthGuard } from '../../core';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/inicio/inicio.component').then((m) => m.InicioComponent),
    canActivate: [AuthGuard],
  },
];
