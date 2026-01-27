import { Routes } from '@angular/router';
import { AuthGuard } from '../../core';
import { ActividadShellComponent } from './pages/actividad-shell/actividad-shell.component';

export const ACTIVIDAD_ROUTES: Routes = [
  {
    path: '',
    component: ActividadShellComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'hoy', pathMatch: 'full' },
      {
        path: 'hoy',
        loadComponent: () =>
          import('./pages/actividad-hoy/actividad-hoy.component').then(
            (m) => m.ActividadHoyComponent
          ),
      },
      {
        path: 'calendario',
        loadComponent: () =>
          import('./pages/actividad-calendario/actividad-calendario.component').then(
            (m) => m.ActividadCalendarioComponent
          ),
      },
      {
        path: 'estadisticas',
        loadComponent: () =>
          import('./pages/actividad-estadisticas/actividad-estadisticas.component').then(
            (m) => m.ActividadEstadisticasComponent
          ),
      },
    ],
  },
];
