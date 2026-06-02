import { Routes } from '@angular/router';
import {
  AuthGuard,
  FisioGuard,
  AdminGuard,
  clinicaActivaResourceGuard,
} from '../../core';

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
    path: 'asignacion',
    loadComponent: () =>
      import('./pages/asignacion-responsable/asignacion-responsable.component').then(
        (m) => m.AsignacionResponsableComponent
      ),
    canActivate: [AuthGuard, FisioGuard, AdminGuard],
  },
  {
    path: ':id/sesion/:fecha',
    loadComponent: () =>
      import('./pages/sesion-detail/sesion-detail.component').then(
        (m) => m.SesionDetailComponent
      ),
    canActivate: [
      AuthGuard,
      FisioGuard,
      clinicaActivaResourceGuard('paciente'),
    ],
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/paciente-detail/paciente-detail.component').then(
        (m) => m.PacienteDetailComponent
      ),
    canActivate: [
      AuthGuard,
      FisioGuard,
      clinicaActivaResourceGuard('paciente'),
    ],
  },
];
