import { Routes } from '@angular/router';
import {
  AuthGuard,
  FisioGuard,
  PacienteGuard,
  InicioRedirectGuard,
} from '../../core';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    canActivate: [AuthGuard, InicioRedirectGuard],
    children: [
      {
        path: 'fisio',
        loadComponent: () =>
          import('./pages/inicio/inicio-fisio/inicio-fisio.component').then(
            (m) => m.InicioFisioComponent,
          ),
        canActivate: [FisioGuard],
      },
      {
        path: 'paciente',
        loadComponent: () =>
          import(
            './pages/inicio/inicio-paciente/inicio-paciente.component'
          ).then((m) => m.InicioPacienteComponent),
        canActivate: [PacienteGuard],
      },
    ],
  },
];
