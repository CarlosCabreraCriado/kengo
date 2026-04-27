import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './features/auth/auth.routes';

export const routes: Routes = [
  { path: '', redirectTo: '/inicio', pathMatch: 'full' },

  ...AUTH_ROUTES,

  {
    path: 'inicio',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then(
        (m) => m.DASHBOARD_ROUTES,
      ),
  },

  {
    path: 'galeria',
    loadChildren: () =>
      import('./features/galeria/galeria.routes').then(
        (m) => m.GALERIA_ROUTES,
      ),
  },

  {
    path: 'rutinas',
    loadChildren: () =>
      import('./features/rutinas/rutinas.routes').then(
        (m) => m.RUTINAS_ROUTES,
      ),
  },

  {
    path: 'mis-pacientes',
    loadChildren: () =>
      import('./features/pacientes/pacientes.routes').then(
        (m) => m.PACIENTES_ROUTES,
      ),
  },

  {
    path: 'mi-clinica',
    loadChildren: () =>
      import('./features/clinica/clinica.routes').then(
        (m) => m.CLINICA_ROUTES,
      ),
  },

  {
    path: 'planes',
    loadChildren: () =>
      import('./features/planes/planes.routes').then((m) => m.PLANES_ROUTES),
  },

  {
    path: 'actividad-personal',
    loadChildren: () =>
      import('./features/actividad/actividad.routes').then(
        (m) => m.ACTIVIDAD_ROUTES,
      ),
  },

  {
    path: 'mi-plan',
    loadChildren: () =>
      import('./features/sesion/sesion.routes').then((m) => m.SESION_ROUTES),
  },

  {
    path: 'perfil',
    loadChildren: () =>
      import('./features/perfil/perfil.routes').then((m) => m.PERFIL_ROUTES),
  },
];
