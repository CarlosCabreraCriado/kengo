import { Routes } from '@angular/router';
import { AuthGuard, FisioGuard } from '../../core';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const PLANES_ROUTES: Routes = [
  { path: '', redirectTo: '/inicio', pathMatch: 'full' },
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
