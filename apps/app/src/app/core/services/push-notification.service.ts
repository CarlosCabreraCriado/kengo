import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import type { Notification } from '@capacitor-firebase/messaging';
import { ConvexService } from '../convex/convex.service';
import { PlatformService } from './platform.service';
import { LoggerService } from './logger.service';
import { api } from '../../../../../../convex/_generated/api';

type PermissionState = 'unknown' | 'granted' | 'denied' | 'prompt';

/**
 * Gestión de push notifications nativas (iOS + Android) vía
 * `@capacitor-firebase/messaging`. En web es no-op: la app PWA no recibe
 * push en esta iteración.
 *
 * Ciclo:
 *  - `init()` se invoca desde `AppComponent` cuando hay sesión válida. Pide
 *    permisos, obtiene el token FCM y lo registra en Convex
 *    (`api.push.mutations.registerPushToken`).
 *  - Listeners de `tokenReceived` re-registran en caso de rotación.
 *  - `notificationReceived` (foreground): no navegamos, dejamos que el
 *    sistema muestre el banner (configurado en `capacitor.config.ts` →
 *    `FirebaseMessaging.presentationOptions`).
 *  - `notificationActionPerformed` (tap del usuario): navega según
 *    `notification.data.type`.
 *  - `teardown()` se invoca desde el flujo de logout (`AuthService.logout`)
 *    para borrar el token del usuario actual y limpiar listeners.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private convex = inject(ConvexService);
  private platform = inject(PlatformService);
  private router = inject(Router);
  private logger = inject(LoggerService);

  private _permissionState = signal<PermissionState>('unknown');
  private _token = signal<string | null>(null);
  private _initialized = signal(false);

  readonly permissionState = this._permissionState.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isInitialized = this._initialized.asReadonly();
  readonly isSupported = computed(() => this.platform.isNative());

  private listenersRegistered = false;
  private cachedDeviceId: string | null = null;

  /** Promesa de un `init()` en curso, para deduplicar llamadas concurrentes. */
  private initInFlight: Promise<void> | null = null;
  /** Nº de reintentos ya programados en esta secuencia de init. */
  private retriesScheduled = 0;
  private static readonly RETRY_DELAYS_MS = [1000, 5000, 15000];

  /**
   * Import dinámico del plugin: el SDK web de Firebase que arrastra
   * `@capacitor-firebase/messaging` pesa en el bundle inicial y solo se usa
   * en nativo y después de tener sesión. Con el import diferido, el chunk se
   * descarga la primera vez que se necesita (init/teardown/clearBadge).
   */
  private async plugin() {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    return FirebaseMessaging;
  }

  /** Import diferido del plugin de badge (solo se usa en nativo). */
  private async badgePlugin() {
    const { Badge } = await import('@capawesome/capacitor-badge');
    return Badge;
  }

  /**
   * Inicializa (o refresca) el sistema de push para el usuario autenticado
   * actual. Idempotente y seguro de llamar múltiples veces: pide permisos si
   * hace falta, obtiene el token FCM y lo re-registra en Convex (upsert por
   * dispositivo, que además refresca `lastSeenAt`). Llamar tras tener sesión
   * válida, y también al volver a foreground o tras un re-login.
   *
   * Si `getToken()` o `requestPermissions()` fallan (p. ej. carrera de iOS en
   * la que el token APNs aún no está disponible), reintenta con backoff
   * (1 s / 5 s / 15 s) en vez de rendirse hasta reiniciar la app.
   */
  init(): Promise<void> {
    if (this.initInFlight) return this.initInFlight;
    this.initInFlight = this.doInit().finally(() => {
      this.initInFlight = null;
    });
    return this.initInFlight;
  }

  /** Alias semántico para llamadas de "refresco" (foreground/resume). */
  touch(): Promise<void> {
    return this.init();
  }

  private async doInit(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this._initialized.set(true);
      return;
    }

    try {
      const messaging = await this.plugin();
      const perm = await messaging.requestPermissions();
      this._permissionState.set(perm.receive as PermissionState);
      if (perm.receive !== 'granted') {
        this._initialized.set(true);
        return;
      }

      const deviceId = await this.getDeviceId();
      const { token } = await messaging.getToken();
      this._token.set(token);

      await this.registerToken(token, deviceId);
      await this.registerListeners();
      this._initialized.set(true);
      this.retriesScheduled = 0;
    } catch (err) {
      this.logger.error('[Push] init falló:', err);
      this.scheduleRetry();
    }
  }

  /**
   * Programa un reintento de `init()` con backoff. Hasta 3 intentos; tras
   * agotarlos marca inicializado para no bloquear otras llamadas (un futuro
   * `resume` volverá a intentarlo).
   */
  private scheduleRetry(): void {
    if (this.retriesScheduled >= PushNotificationService.RETRY_DELAYS_MS.length) {
      this._initialized.set(true);
      this.retriesScheduled = 0;
      return;
    }
    const delay =
      PushNotificationService.RETRY_DELAYS_MS[this.retriesScheduled];
    this.retriesScheduled += 1;
    setTimeout(() => {
      void this.init();
    }, delay);
  }

  /**
   * Sincroniza `permissionState` con el estado real del sistema sin pedir
   * permiso. Útil al volver a foreground: el usuario puede haberlo cambiado
   * en Ajustes. No registra token; solo actualiza el signal para la UI.
   */
  async refreshPermissionState(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const messaging = await this.plugin();
      const perm = await messaging.checkPermissions();
      this._permissionState.set(perm.receive as PermissionState);
    } catch (err) {
      this.logger.warn('[Push] checkPermissions falló (se ignora):', err);
    }
  }

  /**
   * Borra el token del usuario actual y limpia los listeners. Llamar
   * antes de cerrar sesión en Convex; si falla (offline, etc.) se ignora
   * el error para no bloquear el logout.
   */
  async teardown(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.resetLocalState();
      return;
    }

    try {
      const deviceId = await this.getDeviceId();
      // timeoutMs corto: el flujo de logout corre esta mutation en background
      // tras llamar a `convex.clearAuth()`. Si waitForAuth no resuelve en 1 s
      // tras el clearAuth, abandonamos en vez de esperar los 8 s por defecto.
      await this.convex.mutation(
        api.push.mutations.unregisterPushToken,
        { deviceId },
        { timeoutMs: 1000 },
      );
    } catch (err) {
      this.logger.warn('[Push] unregister falló (se ignora):', err);
    }

    try {
      const messaging = await this.plugin();
      await messaging.removeAllListeners();
    } catch {
      // ignorar
    }
    this.resetLocalState();
  }

  private resetLocalState(): void {
    this.listenersRegistered = false;
    this.retriesScheduled = 0;
    this._token.set(null);
    this._initialized.set(false);
  }

  private async getDeviceId(): Promise<string> {
    if (this.cachedDeviceId) return this.cachedDeviceId;
    const { identifier } = await Device.getId();
    this.cachedDeviceId = identifier;
    return identifier;
  }

  private async registerToken(token: string, deviceId: string): Promise<void> {
    const platform = Capacitor.getPlatform();
    if (platform !== 'ios' && platform !== 'android') return;
    await this.convex.mutation(api.push.mutations.registerPushToken, {
      token,
      platform,
      deviceId,
    });
  }

  private async registerListeners(): Promise<void> {
    if (this.listenersRegistered) return;
    this.listenersRegistered = true;

    const messaging = await this.plugin();

    void messaging.addListener('tokenReceived', async ({ token }) => {
      this._token.set(token);
      try {
        const deviceId = await this.getDeviceId();
        await this.registerToken(token, deviceId);
      } catch (err) {
        this.logger.error('[Push] tokenReceived re-register falló:', err);
      }
    });

    void messaging.addListener('notificationActionPerformed', ({ notification }) => {
      this.navigateForNotification(notification);
    });

    // `notificationReceived` se dispara con app en foreground. Como
    // `presentationOptions` está configurado a alert+badge+sound, iOS
    // muestra el banner por su cuenta y no hacemos nada aquí; Android
    // por defecto no muestra notificación en foreground, pero al ser un
    // mensaje del propio chat la UI ya está reaccionando (la query reactiva
    // del thread se actualiza sola). Si en el futuro hace falta un toast
    // in-app, este es el listener donde engancharlo.
    void messaging.addListener('notificationReceived', () => {
      // no-op
    });
  }

  private navigateForNotification(notification: Notification): void {
    const data = (notification.data ?? {}) as Record<string, string>;
    const type = data['type'];
    if (type === 'chat_message' && data['conversationId']) {
      this.router.navigate(['/mensajes', data['conversationId']]);
      return;
    }
    if (type === 'daily_reminder') {
      this.router.navigate(['/']);
      return;
    }
    if (type === 'new_plan') {
      this.router.navigate(['/mi-plan']);
      return;
    }
  }

  /**
   * Limpia las notificaciones entregadas del centro de notificaciones del
   * sistema (la bandeja). Llamar al abrir lista o detalle de conversaciones.
   *
   * Ojo: esto NO toca el número del badge del icono. El contador del icono lo
   * gobierna en exclusiva `setBadge()` (llamado reactivamente por
   * `BadgeSyncService` con el total real de no leídos). No mezclar ambas
   * responsabilidades: `clearBadge` limpia la bandeja, `setBadge` fija el número.
   */
  async clearBadge(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const messaging = await this.plugin();
      await messaging.removeAllDeliveredNotifications();
    } catch (err) {
      this.logger.warn('[Push] clearBadge falló (se ignora):', err);
    }
  }

  /**
   * Fija el número del badge del icono de la app al valor dado. Es la única
   * fuente de verdad del contador del icono mientras la app está viva; el
   * servidor solo lo setea vía payload APNs cuando la app está cerrada.
   *
   * Solo iOS: es donde el badge numérico es un problema real (el server lo
   * sube pero nada lo baja al leer). En Android el `aps.badge` se ignora y el
   * "dot" del launcher se gestiona vaciando la bandeja (`clearBadge`), así que
   * aquí es no-op. Best-effort: si no hay permiso de badge, `Badge.set` es
   * no-op silencioso; envolvemos en try/catch para no romper nunca el flujo.
   */
  async setBadge(count: number): Promise<void> {
    if (!this.platform.isIOS()) return;
    try {
      const badge = await this.badgePlugin();
      await badge.set({ count: Math.max(0, Math.trunc(count)) });
    } catch (err) {
      this.logger.warn('[Push] setBadge falló (se ignora):', err);
    }
  }
}
