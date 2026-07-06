import { inject, Injectable, NgZone } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthService } from '../auth/services/auth.service';
import { SessionService } from '../auth/services/session.service';
import { ConvexService } from '../convex/convex.service';
import { LoggerService } from './logger.service';
import { PlatformService } from './platform.service';
import { PushNotificationService } from './push-notification.service';

/**
 * Ciclo de vida nativo (resume/pause). Sin esto, al volver de background la
 * app no limpia el badge de notificaciones, el overlay de error de conexión
 * exige un tap manual aunque la red haya vuelto, y tras una suspensión larga
 * se muestran datos rancios hasta que Convex resincroniza por su cuenta.
 *
 * NO fuerza reconexión del WebSocket ni refresh del token: ConvexClient
 * reconecta solo y el token se refresca on-demand con retry (convex.service).
 *
 * Solo nativo; AppComponent lo inicializa en `configurarPlataformaNativa()`.
 */
@Injectable({ providedIn: 'root' })
export class AppLifecycleService {
  private readonly platform = inject(PlatformService);
  private readonly ngZone = inject(NgZone);
  private readonly logger = inject(LoggerService);
  private readonly authService = inject(AuthService);
  private readonly sessionService = inject(SessionService);
  private readonly convexService = inject(ConvexService);
  private readonly pushNotifications = inject(PushNotificationService);

  /** Tras una pausa más larga que esto, se refrescan los datos del usuario. */
  private static readonly REFRESH_TRAS_PAUSA_MS = 30 * 60 * 1000;

  private lastPause = 0;

  init(): void {
    if (!this.platform.isNative()) return;

    void CapacitorApp.addListener('pause', () => {
      this.lastPause = Date.now();
    });

    void CapacitorApp.addListener('resume', () => {
      this.ngZone.run(() => this.onResume());
    });
  }

  private onResume(): void {
    // El usuario acaba de abrir la app: las notificaciones pendientes ya no
    // aportan (las verá dentro). Best-effort, no bloquea.
    void this.pushNotifications.clearBadge();

    // Si quedó visible el overlay de error de conexión, reintentar
    // automáticamente — lo habitual es que la red haya vuelto mientras la
    // app estaba en background.
    if (this.sessionService.errorConexion() || this.convexService.tokenError()) {
      void this.authService.reintentarConexion().catch((err) =>
        this.logger.warn('[Lifecycle] reintento en resume falló:', err),
      );
      return;
    }

    // Suspensión larga con sesión activa: refrescar el usuario (rol, clínica,
    // suscripción pueden haber cambiado). Las queries reactivas de Convex se
    // rehidratan solas al reconectar el WebSocket.
    const pausaLarga =
      this.lastPause > 0 &&
      Date.now() - this.lastPause > AppLifecycleService.REFRESH_TRAS_PAUSA_MS;
    if (pausaLarga && this.sessionService.isLoggedIn()) {
      void this.sessionService.cargarMiUsuario().catch((err) =>
        this.logger.warn('[Lifecycle] refresh de usuario en resume falló:', err),
      );
    }
  }
}
