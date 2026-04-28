import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { SessionService } from '../auth/services/session.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  private sessionService = inject(SessionService);
  private router = inject(Router);

  canActivate(): boolean {
    if (this.sessionService.esAdmin()) {
      return true;
    }

    this.router.navigate(['/mis-pacientes']);
    return false;
  }
}
