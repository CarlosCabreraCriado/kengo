import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthGuard, FisioGuard, PacienteGuard, SessionService } from '../../core';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => {
          const session = inject(SessionService);
          return session.rolUsuario() === 'fisio'
            ? '/inicio/fisio'
            : '/inicio/paciente';
        },
      },
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
