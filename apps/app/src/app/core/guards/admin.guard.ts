import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { SessionService } from '../auth/services/session.service';
import { PUESTO_ADMINISTRADOR } from '@kengo/shared-models';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  private sessionService = inject(SessionService);
  private router = inject(Router);

  canActivate(): boolean {
    const clinicas = this.sessionService.usuario()?.clinicas ?? [];
    const esAdmin = clinicas.some((c) => c.id_puesto === PUESTO_ADMINISTRADOR);

    if (esAdmin) {
      return true;
    }

    this.router.navigate(['/mis-pacientes']);
    return false;
  }
}
