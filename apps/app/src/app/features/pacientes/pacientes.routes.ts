import { Routes } from '@angular/router';
import { AuthGuard, FisioGuard } from '../../core';

export const PACIENTES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/pacientes-list/pacientes-list.component').then(
        (m) => m.PacientesListComponent
      ),
    canActivate: [AuthGuard, FisioGuard],
  },
  {
    path: ':id/sesion/:fecha',
    loadComponent: () =>
      import('./pages/sesion-detail/sesion-detail.component').then(
        (m) => m.SesionDetailComponent
      ),
    canActivate: [AuthGuard, FisioGuard],
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/paciente-detail/paciente-detail.component').then(
        (m) => m.PacienteDetailComponent
      ),
    canActivate: [AuthGuard, FisioGuard],
  },
];
