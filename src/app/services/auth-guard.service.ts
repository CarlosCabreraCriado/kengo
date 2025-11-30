import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AppService } from './app.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private auth = inject(AuthService);
  private appService = inject(AppService);
  private router = inject(Router);

  async canActivate(): Promise<boolean> {
    // Si ya está logueado Y el usuario está cargado
    if (this.auth.isLoggedIn() && this.appService.usuario()) {
      return true;
    }

    // Verificar con el servidor
    const hasSession = await this.auth.checkSession();
    if (hasSession) {
      // Cargar usuario si no está cargado
      if (!this.appService.usuario()) {
        await this.appService.cargarMiUsuario();
      }
      return true;
    }

    // No hay sesión, redirigir a login
    this.router.navigate(['/login']);
    return false;
  }
}
