import { Routes } from '@angular/router';
import { AuthGuard, FisioGuard } from '../../core';

export const EJERCICIOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/ejercicios-list/ejercicios-list.component').then(
        (m) => m.EjerciciosListComponent
      ),
    canActivate: [AuthGuard, FisioGuard],
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/ejercicio-detail/ejercicio-detail.component').then(
        (m) => m.EjercicioDetailComponent
      ),
    canActivate: [AuthGuard, FisioGuard],
  },
];
