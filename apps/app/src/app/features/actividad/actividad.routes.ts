import { Routes } from '@angular/router';
import { AuthGuard } from '../../core';

export const ACTIVIDAD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/actividad-personal/actividad-personal.component').then(
        (m) => m.ActividadPersonalComponent
      ),
    canActivate: [AuthGuard],
  },
];
