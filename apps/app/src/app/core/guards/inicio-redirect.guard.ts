import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { SessionService } from '../auth/services/session.service';

@Injectable({ providedIn: 'root' })
export class InicioRedirectGuard implements CanActivate {
  private sessionService = inject(SessionService);
  private router = inject(Router);

  canActivate(): UrlTree {
    return this.sessionService.rolUsuario() === 'fisio'
      ? this.router.parseUrl('/inicio/fisio')
      : this.router.parseUrl('/inicio/paciente');
  }
}
