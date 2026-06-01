import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { SessionService } from '../auth/services/session.service';
import { ClinicaActivaService } from '../auth/services/clinica-activa.service';

/**
 * Garantiza que existe una clínica activa válida antes de entrar a rutas
 * operativas (listas, dashboard, planes, sesiones).
 *
 *   - Sin clínicas → deja pasar (OnboardingGuard se encarga de redirigir).
 *   - 1 clínica → la autoselección de `ClinicasService` ya la fija; si por
 *     timing aún no se ha hecho, deja pasar (el effect la fijará).
 *   - >1 clínicas con activa válida → ok.
 *   - >1 clínicas sin activa válida → redirige a /seleccionar-clinica
 *     pasando la URL solicitada como `next` para retomar la navegación.
 */
@Injectable({ providedIn: 'root' })
export class ClinicaActivaGuard implements CanActivate {
  private session = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  private router = inject(Router);

  canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): boolean | UrlTree {
    const clinicas = this.session.misclinicas();
    if (clinicas.length === 0) return true;
    if (clinicas.length === 1) return true;

    const activa = this.clinicaActiva.selectedClinicaId();
    if (activa && clinicas.some((c) => c.clinicId === activa)) return true;

    return this.router.createUrlTree(['/seleccionar-clinica'], {
      queryParams: { next: state.url },
    });
  }
}
