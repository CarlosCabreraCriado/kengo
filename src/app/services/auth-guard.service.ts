import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private auth = inject(AuthService);
  private router = inject(Router);

  async canActivate(): Promise<boolean> {
    // Si ya sabemos que está logueado
    if (this.auth.isLoggedIn()) {
      return true;
    }

    // Verificar con el servidor
    const hasSession = await this.auth.checkSession();
    if (hasSession) {
      return true;
    }

    // No hay sesión, redirigir a login
    this.router.navigate(['/login']);
    return false;
  }
}
