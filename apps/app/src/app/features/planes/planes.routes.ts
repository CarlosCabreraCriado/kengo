import { Routes } from '@angular/router';
import { AuthGuard, FisioGuard } from '../../core';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const PLANES_ROUTES: Routes = [
  // Vista mixta intencional: el componente discrimina por rol y muestra
  // tabs distintas (fisio: planes-pacientes/rutinas/mis-planes; paciente:
  // solo mis-planes). Por eso lleva sólo `AuthGuard` y no `FisioGuard`.
  {
    path: '',
    loadComponent: () =>
      import('./pages/planes-list/planes.component').then(
        (m) => m.PlanesComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./pages/plan-builder/plan-builder.component').then(
        (m) => m.PlanBuilderComponent,
      ),
    canActivate: [AuthGuard, FisioGuard],
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./pages/plan-builder/plan-builder.component').then(
        (m) => m.PlanBuilderComponent,
      ),
    canActivate: [AuthGuard, FisioGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/plan-detail/plan-detail.component').then(
        (m) => m.PlanDetailComponent,
      ),
    canActivate: [AuthGuard],
  },
];
