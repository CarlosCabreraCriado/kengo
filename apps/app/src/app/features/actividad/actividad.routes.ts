import { Routes } from '@angular/router';
import { AuthGuard } from '../../core';

export const ACTIVIDAD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/actividad-diaria/actividad-diaria.component').then(
        (m) => m.ActividadDiariaComponent
      ),
    canActivate: [AuthGuard],
  },
];
