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
    // Esperar a que la inicialización (lanzada por AppComponent) termine.
    // Si ya terminó, esto es no-op porque la promesa cacheada estará null y
    // el método retornará una promesa ya resuelta. Si está en curso, nos
    // pegamos a ella en vez de tirar otra query en paralelo.
    await this.auth.iniciarApp();

    // Si hay sesión guardada pero no se pudo validar por red/5xx, permitimos
    // la navegación: el overlay <app-connection-error> tapará el dashboard y
    // ofrecerá reintento. Si redirigiéramos a /login el usuario perdería
    // contexto y vería un formulario que tampoco va a funcionar.
    if (this.sessionService.errorConexion()) {
      return true;
    }

    if (this.auth.isLoggedIn() && this.sessionService.usuario()) {
      return true;
    }

    // Re-chequear por si la sesión llegó después del primer iniciarApp
    // (ej. login en otra pestaña). Distinguimos red de auth.
    const result = await this.auth.checkSession();
    if (result === 'ok') {
      if (!this.sessionService.usuario()) {
        await this.sessionService.cargarMiUsuario();
      }
      return true;
    }
    if (result === 'network-error') {
      this.sessionService.marcarErrorConexion();
      return true;
    }

    this.router.navigate(['/login']);
    return false;
  }
}
