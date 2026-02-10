import { Routes } from '@angular/router';
import { AuthGuard } from './core';
import { unsavedChangesGuard } from './features/planes/guards/unsaved-changes.guard';

export const routes: Routes = [
  // Redirección raíz
  { path: '', redirectTo: '/inicio', pathMatch: 'full' },

  // Auth routes (lazy loaded)
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then(
        (m) => m.LoginComponent
      ),
  },
  {
    path: 'magic',
    loadComponent: () =>
      import('./features/auth/pages/magic/magic.component').then(
        (m) => m.MagicComponent
      ),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./features/auth/pages/registro/registro.component').then(
        (m) => m.RegistroComponent
      ),
  },
  {
    path: 'recuperar-password',
    loadComponent: () =>
      import('./features/auth/pages/recuperar-password/recuperar-password.component').then(
        (m) => m.RecuperarPasswordComponent
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
  },
  {
    path: 'establecer-password',
    loadComponent: () =>
      import('./features/auth/pages/establecer-password/establecer-password.component').then(
        (m) => m.EstablecerPasswordComponent
      ),
    canActivate: [AuthGuard],
  },

  // Dashboard (inicio)
  {
    path: 'inicio',
    loadComponent: () =>
      import('./features/dashboard/pages/inicio/inicio/inicio.component').then(
        (m) => m.InicioComponent
      ),
    canActivate: [AuthGuard],
  },

  // Galería (ejercicios + rutinas)
  {
    path: 'galeria',
    loadChildren: () =>
      import('./features/galeria/galeria.routes').then(
        (m) => m.GALERIA_ROUTES
      ),
  },

  // Rutina Builder (crear plantilla)
  {
    path: 'rutinas/nueva',
    loadComponent: () =>
      import('./features/rutinas/pages/rutina-builder/rutina-builder.component').then(
        (m) => m.RutinaBuilderComponent
      ),
    canActivate: [AuthGuard],
  },

  // Pacientes (lazy loaded feature)
  {
    path: 'mis-pacientes',
    loadChildren: () =>
      import('./features/pacientes/pacientes.routes').then(
        (m) => m.PACIENTES_ROUTES
      ),
  },

  // Clínica
  {
    path: 'mi-clinica',
    loadComponent: () =>
      import('./features/clinica/pages/miclinica/miclinica.component').then(
        (m) => m.MiClinicaComponent
      ),
    canActivate: [AuthGuard],
  },

  // Planes (lazy loaded)
  {
    path: 'planes',
    loadComponent: () =>
      import('./features/planes/pages/planes-list/planes.component').then(
        (m) => m.PlanesComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'planes/nuevo',
    loadComponent: () =>
      import('./features/planes/pages/plan-builder/plan-builder.component').then(
        (m) => m.PlanBuilderComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'planes/:id/editar',
    loadComponent: () =>
      import('./features/planes/pages/plan-builder/plan-builder.component').then(
        (m) => m.PlanBuilderComponent
      ),
    canActivate: [AuthGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'planes/:id',
    loadComponent: () =>
      import('./features/planes/pages/plan-detail/plan-detail.component').then(
        (m) => m.PlanDetailComponent
      ),
    canActivate: [AuthGuard],
  },

  // Actividad personal
  {
    path: 'actividad-personal',
    loadChildren: () =>
      import('./features/actividad/actividad.routes').then(
        (m) => m.ACTIVIDAD_ROUTES
      ),
  },

  // Sesión / Realizar plan
  {
    path: 'mi-plan',
    loadComponent: () =>
      import('./features/sesion/pages/realizar-plan/realizar-plan.component').then(
        (m) => m.RealizarPlanComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'mi-plan/:planId',
    loadComponent: () =>
      import('./features/sesion/pages/realizar-plan/realizar-plan.component').then(
        (m) => m.RealizarPlanComponent
      ),
    canActivate: [AuthGuard],
  },

  // Perfil
  {
    path: 'perfil',
    loadComponent: () =>
      import('./features/perfil/pages/perfil/perfil/perfil.component').then(
        (m) => m.PerfilComponent
      ),
    canActivate: [AuthGuard],
  },
];
