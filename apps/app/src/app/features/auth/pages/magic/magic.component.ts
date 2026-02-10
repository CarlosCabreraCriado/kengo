import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { Router, ActivatedRoute } from '@angular/router';

type TokenError =
  | 'TOKEN_NO_PROPORCIONADO'
  | 'TOKEN_NO_ENCONTRADO'
  | 'TOKEN_INACTIVO'
  | 'TOKEN_EXPIRADO'
  | 'TOKEN_AGOTADO'
  | 'ERROR_DESCONOCIDO';

const ERROR_MESSAGES: Record<TokenError, string> = {
  TOKEN_NO_PROPORCIONADO: 'No se proporcionó un enlace válido',
  TOKEN_NO_ENCONTRADO: 'Este enlace no existe o ya fue utilizado',
  TOKEN_INACTIVO: 'Este enlace ha sido desactivado',
  TOKEN_EXPIRADO: 'Este enlace ha expirado',
  TOKEN_AGOTADO: 'Este enlace ya no tiene más usos disponibles',
  ERROR_DESCONOCIDO: 'Ocurrió un error al procesar el enlace',
};

@Component({
  standalone: true,
  selector: 'app-magic',
  imports: [RouterLink],
  templateUrl: './magic.component.html',
  styleUrl: './magic.component.css',
})
export class MagicComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  loading = signal(true);
  errorCode = signal<TokenError | null>(null);

  errorMessage = computed(() => {
    const code = this.errorCode();
    return code ? ERROR_MESSAGES[code] : null;
  });

  async ngOnInit() {
    // Soportar tanto 't' (nuevo) como 'token' (legacy) como parámetros
    const token =
      this.route.snapshot.queryParamMap.get('t') ||
      this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.errorCode.set('TOKEN_NO_PROPORCIONADO');
      this.loading.set(false);
      return;
    }

    try {
      // Limpiar sesión previa si existe
      await this.authService.logout(true);

      // Consumir token de acceso (el BFF establece la cookie)
      const result = await this.authService.consumirTokenAcceso(token);

      // Cargar usuario antes de navegar para que AuthGuard pase por fast path
      await this.sessionService.cargarMiUsuario();

      if (!result.tienePassword) {
        // Redirigir a establecer contraseña
        this.router.navigate(['/establecer-password'], {
          state: { email: result.email },
        });
      } else {
        // Redirigir a inicio
        this.router.navigateByUrl('/inicio');
      }
    } catch (err: unknown) {
      const httpError = err as { error?: { error?: string } };
      const errorFromServer = httpError?.error?.error as TokenError | undefined;
      this.errorCode.set(errorFromServer || 'ERROR_DESCONOCIDO');
      this.loading.set(false);
    }
  }
}
