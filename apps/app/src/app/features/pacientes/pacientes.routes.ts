import { Routes } from '@angular/router';
import { AuthGuard } from '../../core';

export const PACIENTES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/pacientes-list/pacientes-list.component').then(
        (m) => m.PacientesListComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/paciente-detail/paciente-detail.component').then(
        (m) => m.PacienteDetailComponent
      ),
    canActivate: [AuthGuard],
  },
];
