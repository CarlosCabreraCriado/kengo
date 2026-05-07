import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  UrlTree,
} from '@angular/router';
import { SessionService } from '../auth/services/session.service';

/**
 * Redirige usuarios autenticados según su pertenencia a clínicas:
 * - En `/inicio*` sin clínica → `/onboarding`.
 * - En `/onboarding*` con al menos una clínica → `/inicio`.
 *
 * Asume que `AuthGuard` ya validó la sesión y cargó el usuario en
 * SessionService antes de que este guard se evalúe.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingGuard implements CanActivate {
  private sessionService = inject(SessionService);
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const url = '/' + route.pathFromRoot
      .map((r) => r.url.map((s) => s.path).join('/'))
      .filter(Boolean)
      .join('/');

    const sinClinica = this.sessionService.sinClinica();
    const enOnboarding = url.startsWith('/onboarding');

    if (enOnboarding && !sinClinica) {
      return this.router.createUrlTree(['/inicio']);
    }
    if (!enOnboarding && sinClinica) {
      return this.router.createUrlTree(['/onboarding']);
    }
    return true;
  }
}
