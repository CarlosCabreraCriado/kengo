import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';
import { SessionService } from '../auth/services/session.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private auth = inject(AuthService);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  async canActivate(): Promise<boolean> {
    // Si ya está logueado Y el usuario está cargado
    if (this.auth.isLoggedIn() && this.sessionService.usuario()) {
      return true;
    }

    // Verificar con el servidor
    const hasSession = await this.auth.checkSession();
    if (hasSession) {
      // Cargar usuario si no está cargado
      if (!this.sessionService.usuario()) {
        await this.sessionService.cargarMiUsuario();
      }
      return true;
    }

    // No hay sesión, redirigir a login
    this.router.navigate(['/login']);
    return false;
  }
}
