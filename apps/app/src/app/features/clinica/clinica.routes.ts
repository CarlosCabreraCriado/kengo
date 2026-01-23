import { Routes } from '@angular/router';
import { AuthGuard } from '../../core';

export const CLINICA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/miclinica/miclinica.component').then(
        (m) => m.MiClinicaComponent
      ),
    canActivate: [AuthGuard],
  },
];
