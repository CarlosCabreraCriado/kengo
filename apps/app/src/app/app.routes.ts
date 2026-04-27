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
    path: 'ejercicios',
    loadChildren: () =>
      import('./features/ejercicios/ejercicios.routes').then(
        (m) => m.EJERCICIOS_ROUTES,
      ),
  },

  {
    path: 'rutinas',
    loadChildren: () =>
      import('./features/rutinas/rutinas.routes').then(
        (m) => m.RUTINAS_ROUTES,
      ),
  },

  // Redirects legados: la feature galeria/ se eliminó (#4.2 auditoría).
  { path: 'galeria', redirectTo: '/ejercicios', pathMatch: 'full' },
  { path: 'galeria/ejercicios', redirectTo: '/ejercicios', pathMatch: 'full' },
  { path: 'galeria/ejercicios/:id', redirectTo: '/ejercicios/:id' },
  { path: 'galeria/rutinas', redirectTo: '/rutinas', pathMatch: 'full' },

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
