import { Routes } from '@angular/router';
import { AuthGuard } from '../../core';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'magic',
    loadComponent: () =>
      import('./pages/magic/magic.component').then((m) => m.MagicComponent),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./pages/registro/registro.component').then(
        (m) => m.RegistroComponent,
      ),
  },
  {
    path: 'recuperar-password',
    loadComponent: () =>
      import('./pages/recuperar-password/recuperar-password.component').then(
        (m) => m.RecuperarPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'establecer-password',
    loadComponent: () =>
      import('./pages/establecer-password/establecer-password.component').then(
        (m) => m.EstablecerPasswordComponent,
      ),
    canActivate: [AuthGuard],
  },
];
