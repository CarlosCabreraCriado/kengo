import { Routes } from '@angular/router';
import { AuthGuard, PacienteGuard } from '../../core';

export const SESION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/realizar-plan/realizar-plan.component').then(
        (m) => m.RealizarPlanComponent,
      ),
    canActivate: [AuthGuard, PacienteGuard],
  },
  {
    path: ':planId',
    loadComponent: () =>
      import('./pages/realizar-plan/realizar-plan.component').then(
        (m) => m.RealizarPlanComponent,
      ),
    canActivate: [AuthGuard, PacienteGuard],
  },
];
