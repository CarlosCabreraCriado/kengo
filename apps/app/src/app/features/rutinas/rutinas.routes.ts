import { Routes } from '@angular/router';
import { AuthGuard, FisioGuard } from '../../core';
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
    canActivate: [AuthGuard, FisioGuard],
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./pages/rutina-builder/rutina-builder.component').then(
        (m) => m.RutinaBuilderComponent,
      ),
    canActivate: [AuthGuard, FisioGuard],
    canDeactivate: [rutinaUnsavedChangesGuard],
  },
];
