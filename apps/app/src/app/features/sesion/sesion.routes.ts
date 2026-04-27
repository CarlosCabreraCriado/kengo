import { Routes } from '@angular/router';
import { AuthGuard } from '../../core';

export const SESION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/realizar-plan/realizar-plan.component').then(
        (m) => m.RealizarPlanComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: ':planId',
    loadComponent: () =>
      import('./pages/realizar-plan/realizar-plan.component').then(
        (m) => m.RealizarPlanComponent,
      ),
    canActivate: [AuthGuard],
  },
];
