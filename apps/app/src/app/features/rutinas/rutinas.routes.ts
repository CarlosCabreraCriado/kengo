import { Routes } from '@angular/router';
import { ActiveSubscriptionGuard, AuthGuard, FisioGuard } from '../../core';
import { rutinaUnsavedChangesGuard } from './guards/rutina-unsaved-changes.guard';

export const RUTINAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/rutinas-list/rutinas-list.component').then(
        (m) => m.RutinasListComponent,
      ),
    canActivate: [AuthGuard, FisioGuard],
  },
  {
    path: 'nueva',
    loadComponent: () =>
      import('./pages/rutina-builder/rutina-builder.component').then(
        (m) => m.RutinaBuilderComponent,
      ),
    canActivate: [AuthGuard, FisioGuard, ActiveSubscriptionGuard],
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./pages/rutina-builder/rutina-builder.component').then(
        (m) => m.RutinaBuilderComponent,
      ),
    canActivate: [AuthGuard, FisioGuard, ActiveSubscriptionGuard],
    canDeactivate: [rutinaUnsavedChangesGuard],
  },
];
