import { Routes } from '@angular/router';

export const GALERIA_ROUTES: Routes = [
  { path: '', redirectTo: 'ejercicios', pathMatch: 'full' },
  {
    path: 'ejercicios',
    loadChildren: () =>
      import('../ejercicios/ejercicios.routes').then((m) => m.EJERCICIOS_ROUTES),
  },
  {
    path: 'rutinas',
    loadComponent: () =>
      import('../rutinas/pages/rutinas-list/rutinas-list.component').then(
        (m) => m.RutinasListComponent
      ),
  },
];
