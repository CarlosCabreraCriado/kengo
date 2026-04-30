import { Routes } from '@angular/router';
import { AuthGuard, ClinicAdminGuard } from '../../core';

export const CLINICA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/miclinica/miclinica.component').then(
        (m) => m.MiClinicaComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'suscripcion',
    loadComponent: () =>
      import('./pages/suscripcion/suscripcion.component').then(
        (m) => m.SuscripcionComponent
      ),
    canActivate: [AuthGuard, ClinicAdminGuard],
  },
];
