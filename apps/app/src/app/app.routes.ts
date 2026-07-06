import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import {
  AuthGuard,
  ClinicaActivaGuard,
  OnboardingGuard,
  SoporteGuard,
} from './core';

/**
 * Convención de naming de rutas:
 * - 'mi-' + singular: recurso propio único
 *   (ej: /mi-clinica, /mi-plan)
 * - 'mis-' + plural: colección propia
 *   (ej: /mis-pacientes)
 * - plural sin posesivo: catálogo compartido por rol
 *   (ej: /ejercicios, /rutinas, /planes)
 * - singular sin posesivo: vista única
 *   (ej: /perfil, /inicio, /actividad-personal)
 *
 * Inconsistencia aceptada: /mi-plan (singular) vs /mis-pacientes (plural)
 * — ambas son del paciente. Renombrar implicaría romper bookmarks; queda
 * como deuda registrada en docs/AUDITORIA_FRONTEND.md #3.5.
 */
export const routes: Routes = [
  { path: '', redirectTo: '/inicio', pathMatch: 'full' },

  ...AUTH_ROUTES,

  {
    path: 'inicio',
    canActivate: [AuthGuard, OnboardingGuard, ClinicaActivaGuard],
    // `data.preload` la consume SessionPreloadStrategy: descarga el chunk en
    // idle tras iniciar sesión, solo si el rol coincide ('fisio'|'paciente')
    // o para ambos (true). La precarga NO ejecuta guards.
    data: { preload: true },
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then(
        (m) => m.DASHBOARD_ROUTES,
      ),
  },

  {
    path: 'onboarding',
    // Guard en la ruta `loadChildren` (no solo en la hija) para no descargar
    // el bundle de onboarding a usuarios sin sesión. OnboardingGuard aquí no
    // hace loop: solo redirige a /inicio cuando el usuario YA tiene clínica.
    canActivate: [AuthGuard, OnboardingGuard],
    loadChildren: () =>
      import('./features/onboarding/onboarding.routes').then(
        (m) => m.ONBOARDING_ROUTES,
      ),
  },

  // Pantalla intermedia para usuarios con varias clínicas sin contexto activo
  // todavía. La protege AuthGuard + OnboardingGuard pero NO ClinicaActivaGuard
  // (sería un loop).
  {
    path: 'seleccionar-clinica',
    canActivate: [AuthGuard, OnboardingGuard],
    loadComponent: () =>
      import(
        './features/clinica/pages/seleccionar-clinica/seleccionar-clinica.component'
      ).then((m) => m.SeleccionarClinicaComponent),
  },

  // Pasarela de invitación: decide canje, login o registro según el estado
  // del usuario. Sin AuthGuard (el propio componente orquesta).
  {
    path: 'invitacion',
    loadComponent: () =>
      import('./features/invitacion/pages/invitacion/invitacion.component').then(
        (m) => m.InvitacionComponent,
      ),
  },

  {
    path: 'ejercicios',
    canActivate: [AuthGuard, OnboardingGuard, ClinicaActivaGuard],
    data: { preload: 'fisio' },
    loadChildren: () =>
      import('./features/ejercicios/ejercicios.routes').then(
        (m) => m.EJERCICIOS_ROUTES,
      ),
  },

  {
    path: 'rutinas',
    canActivate: [AuthGuard, OnboardingGuard, ClinicaActivaGuard],
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
    canActivate: [AuthGuard, OnboardingGuard, ClinicaActivaGuard],
    data: { preload: 'fisio' },
    loadChildren: () =>
      import('./features/pacientes/pacientes.routes').then(
        (m) => m.PACIENTES_ROUTES,
      ),
  },

  {
    path: 'mi-clinica',
    canActivate: [AuthGuard, OnboardingGuard, ClinicaActivaGuard],
    loadChildren: () =>
      import('./features/clinica/clinica.routes').then(
        (m) => m.CLINICA_ROUTES,
      ),
  },

  {
    path: 'planes',
    canActivate: [AuthGuard, OnboardingGuard, ClinicaActivaGuard],
    data: { preload: 'fisio' },
    loadChildren: () =>
      import('./features/planes/planes.routes').then((m) => m.PLANES_ROUTES),
  },

  {
    path: 'actividad-personal',
    canActivate: [AuthGuard, OnboardingGuard, ClinicaActivaGuard],
    data: { preload: 'paciente' },
    loadChildren: () =>
      import('./features/actividad/actividad.routes').then(
        (m) => m.ACTIVIDAD_ROUTES,
      ),
  },

  {
    path: 'mi-plan',
    canActivate: [AuthGuard, OnboardingGuard, ClinicaActivaGuard],
    data: { preload: 'paciente' },
    loadChildren: () =>
      import('./features/sesion/sesion.routes').then((m) => m.SESION_ROUTES),
  },

  // /perfil queda exento del OnboardingGuard: el usuario sin clínica debe poder
  // gestionar su perfil y cerrar sesión sin estar atrapado.
  {
    path: 'perfil',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./features/perfil/perfil.routes').then((m) => m.PERFIL_ROUTES),
  },

  // Soporte técnico: impersonación de usuarios. Solo accesible para técnicos en
  // la allowlist `SUPPORT_USER_IDS` (gate en SoporteGuard + servidor). Exento de
  // OnboardingGuard/ClinicaActivaGuard porque el técnico opera fuera de clínica.
  {
    path: 'soporte',
    canActivate: [AuthGuard, SoporteGuard],
    loadComponent: () =>
      import('./features/soporte/pages/soporte/soporte.component').then(
        (m) => m.SoporteComponent,
      ),
  },

  {
    path: 'mensajes',
    canActivate: [AuthGuard, OnboardingGuard, ClinicaActivaGuard],
    data: { preload: true },
    loadChildren: () =>
      import('./features/mensajes/mensajes.routes').then(
        (m) => m.MENSAJES_ROUTES,
      ),
  },
];
