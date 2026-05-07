import { Routes } from '@angular/router';
import { AuthGuard, OnboardingGuard } from '../../core';

export const ONBOARDING_ROUTES: Routes = [
  {
    path: '',
    canActivate: [AuthGuard, OnboardingGuard],
    loadComponent: () =>
      import('./pages/onboarding/onboarding.component').then(
        (m) => m.OnboardingComponent,
      ),
  },
];
