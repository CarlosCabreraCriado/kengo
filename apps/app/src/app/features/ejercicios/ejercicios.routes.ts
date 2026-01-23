import { Routes } from '@angular/router';
import { AuthGuard } from '../../core';

export const EJERCICIOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/ejercicios-list/ejercicios-list.component').then(
        (m) => m.EjerciciosListComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/ejercicio-detail/ejercicio-detail.component').then(
        (m) => m.EjercicioDetailComponent
      ),
    canActivate: [AuthGuard],
  },
];
