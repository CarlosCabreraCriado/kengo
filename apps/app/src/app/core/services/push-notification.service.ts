import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import type { Notification } from '@capacitor-firebase/messaging';
import { ConvexService } from '../convex/convex.service';
import type { SessionResettable } from '../auth/session-resettable';
import { PlatformService } from './platform.service';
import { LoggerService } from './logger.service';
import { ToastService } from '../../shared/services/toast/toast.service';
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
 *  - `notificationReceived` (foreground): en iOS no hacemos nada (el sistema
 *    muestra el banner según `FirebaseMessaging.presentationOptions` de
 *    `capacitor.config.ts`); en Android, donde el sistema no muestra nada en
 *    foreground, enseñamos un toast in-app con acción de navegar.
 *  - `notificationActionPerformed` (tap del usuario): navega según
 *    `notification.data.type`.
 *  - `teardown()` se invoca desde el flujo de logout (`AuthService.logout`)
 *    para borrar el token del usuario actual y limpiar listeners.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationService implements SessionResettable {
  private convex = inject(ConvexService);
  private platform = inject(PlatformService);
  private router = inject(Router);
  private logger = inject(LoggerService);
  private toast = inject(ToastService);

  private _permissionState = signal<PermissionState>('unknown');
  private _token = signal<string | null>(null);
  private _initialized = signal(false);

  readonly permissionState = this._permissionState.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isInitialized = this._initialized.asReadonly();
  readonly isSupported = computed(() => this.platform.isNative());

  private listenersRegistered = false;
  private cachedDeviceId: string | null = null;

  /**
   * Caché de `Badge.isSupported()`: es estable durante la vida del proceso
   * (depende del launcher/OS, no de la sesión), así que se consulta una vez.
   */
  private badgeSupported: boolean | null = null;

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
   *
   * Ojo: se devuelve el proxy ENVUELTO en un objeto, nunca a pelo. Resolver
   * una promesa con el proxy de un plugin de Capacitor hace que el runtime
   * compruebe si es thenable accediendo a `.then`, y en Android el bridge lo
   * traduce en la llamada nativa `FirebaseMessaging.then()` → "not
   * implemented on android" en TODA llamada al plugin (en iOS el bridge no lo
   * sufre, por eso este bug solo rompía Android).
   */
  private async plugin() {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    return { messaging: FirebaseMessaging };
  }

  /**
   * Import diferido del plugin de badge (solo se usa en nativo). Envuelto en
   * objeto por el mismo motivo que `plugin()`.
   */
  private async badgePlugin() {
    const { Badge } = await import('@capawesome/capacitor-badge');
    return { badge: Badge };
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
      await this.ensureAndroidChannels();

      const { messaging } = await this.plugin();
      const perm = await messaging.requestPermissions();
      this._permissionState.set(perm.receive as PermissionState);
      if (perm.receive !== 'granted') {
        this._initialized.set(true);
        // Sin permiso no se registrará token, pero el dispositivo puede
        // arrastrar filas de `pushTokens` de una cuenta anterior que seguirían
        // recibiendo sus pushes. `unregisterPushToken` borra por deviceId,
        // sea de quien sea la fila. Best-effort.
        void this.getDeviceId()
          .then((deviceId) =>
            this.convex.mutation(api.push.mutations.unregisterPushToken, {
              deviceId,
            }),
          )
          .catch(() => {
            // best-effort: el barrido de registerPushToken y el cron cubren
          });
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
   * Crea los canales de notificación de Android (8+), uno por tipo, alineados
   * con `notificationPreferences` y con el mapping `ANDROID_CHANNEL_BY_KEY`
   * del backend (`convex/push/actions.ts`). Todos nacen con importancia alta
   * (heads-up); el usuario puede degradarlos por canal en Ajustes del sistema.
   * Idempotente (Android ignora re-creaciones) y best-effort: un fallo aquí no
   * debe impedir el registro del token. Independiente del permiso de
   * notificaciones, así los canales ya existen cuando el usuario lo conceda.
   */
  private async ensureAndroidChannels(): Promise<void> {
    if (!this.platform.isAndroid()) return;
    try {
      const { FirebaseMessaging, Importance } = await import(
        '@capacitor-firebase/messaging'
      );
      const canales = [
        {
          id: 'mensajes',
          name: 'Mensajes',
          description: 'Mensajes de chat con tu fisio o tus pacientes',
        },
        {
          id: 'recordatorios',
          name: 'Recordatorios diarios',
          description: 'Recordatorio diario para completar tus ejercicios',
        },
        {
          id: 'planes',
          name: 'Planes de ejercicios',
          description: 'Avisos cuando tu fisio te asigna o actualiza un plan',
        },
      ];
      for (const canal of canales) {
        await FirebaseMessaging.createChannel({
          ...canal,
          importance: Importance.High,
          vibration: true,
        });
      }
    } catch (err) {
      this.logger.warn('[Push] createChannel falló (se ignora):', err);
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
      const { messaging } = await this.plugin();
      const perm = await messaging.checkPermissions();
      this._permissionState.set(perm.receive as PermissionState);
    } catch (err) {
      this.logger.warn('[Push] checkPermissions falló (se ignora):', err);
    }
  }

  /**
   * Borra los tokens push del dispositivo, resetea el badge del icono, vacía
   * la bandeja y limpia los listeners. Llamar ANTES de `convex.clearAuth()`
   * (la mutation necesita la auth viva); si falla (offline, etc.) se ignora
   * el error para no bloquear el logout.
   */
  async teardown(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.resetLocalState();
      return;
    }

    // Restos visuales de la cuenta saliente: número del icono a 0 y
    // bandeja vacía (los banners navegarían a recursos de la otra cuenta).
    // Locales, sin auth, tragan sus errores.
    void this.setBadge(0);
    void this.clearBadge();

    try {
      const deviceId = await this.getDeviceId();
      // timeoutMs como cinturón: si algo re-llama teardown con la auth ya
      // invalidada, abandonamos en 1 s en vez de esperar los 8 s por defecto.
      await this.convex.mutation(
        api.push.mutations.unregisterPushToken,
        { deviceId },
        { timeoutMs: 1000 },
      );
    } catch (err) {
      this.logger.warn('[Push] unregister falló (se ignora):', err);
    }

    try {
      const { messaging } = await this.plugin();
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

  /**
   * Purga en cierres de sesión que no pasan por `AuthService.logout` (p.ej.
   * sesión zombie en el arranque). Síncrono por contrato; los side-effects
   * nativos son fire-and-forget best-effort. Sin mutation al servidor: en
   * esas rutas la auth ya no es válida — el token residual lo limpian el
   * barrido por deviceId del siguiente login y el cron. En el logout normal
   * duplica parte de `teardown()`, todo idempotente.
   */
  resetSessionState(): void {
    this.resetLocalState();
    if (Capacitor.isNativePlatform()) {
      void this.setBadge(0);
      void this.clearBadge();
      void this.plugin()
        .then(({ messaging }) => messaging.removeAllListeners())
        .catch(() => {
          // best-effort
        });
    }
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

    const { messaging } = await this.plugin();

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

    // `notificationReceived` se dispara con app en foreground. En iOS el
    // sistema ya muestra el banner (`presentationOptions`), así que solo
    // actuamos en Android, donde en foreground no se muestra nada.
    void messaging.addListener('notificationReceived', ({ notification }) => {
      this.handleForegroundNotification(notification);
    });
  }

  /**
   * Aviso in-app para pushes recibidas con la app en foreground (solo
   * Android: el sistema no muestra banner en ese estado). Se suprime cuando
   * el usuario ya está dentro de la conversación del mensaje — ahí la query
   * reactiva del thread pinta el mensaje sola y el toast sería ruido.
   */
  private handleForegroundNotification(notification: Notification): void {
    if (!this.platform.isAndroid()) return;

    const data = (notification.data ?? {}) as Record<string, string>;
    if (
      data['type'] === 'chat_message' &&
      data['conversationId'] &&
      this.router.url.startsWith(`/mensajes/${data['conversationId']}`)
    ) {
      return;
    }

    const mensaje =
      [notification.title, notification.body].filter(Boolean).join(' · ') ||
      'Tienes una notificación nueva';
    this.toast.info(mensaje, {
      action: {
        label: 'Ver',
        callback: () => this.navigateForNotification(notification),
      },
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
   * sistema (la bandeja), en iOS y Android. Llamar al abrir lista o detalle
   * de conversaciones.
   *
   * Ojo: esto NO toca el número del badge del icono. El contador del icono lo
   * gobierna en exclusiva `setBadge()` (llamado reactivamente por
   * `BadgeSyncService` con el total real de no leídos, en launchers que lo
   * soporten). No mezclar ambas responsabilidades: `clearBadge` limpia la
   * bandeja, `setBadge` fija el número.
   */
  async clearBadge(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { messaging } = await this.plugin();
      await messaging.removeAllDeliveredNotifications();
    } catch (err) {
      this.logger.warn('[Push] clearBadge falló (se ignora):', err);
    }
  }

  /**
   * Fija el número del badge del icono de la app al valor dado. Es la única
   * fuente de verdad del contador del icono mientras la app está viva; el
   * servidor solo lo setea cuando la app está cerrada (`aps.badge` en iOS,
   * `notification_count` en Android).
   *
   * iOS y Android: en Android el soporte depende del launcher (Samsung/Xiaomi
   * muestran número; Pixel solo dot), así que se guarda por capacidad con
   * `Badge.isSupported()` (cacheado), no por plataforma. Best-effort: si no
   * hay permiso de badge, `Badge.set` es no-op silencioso; envolvemos en
   * try/catch para no romper nunca el flujo.
   */
  async setBadge(count: number): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { badge } = await this.badgePlugin();
      if (this.badgeSupported === null) {
        const { isSupported } = await badge.isSupported();
        this.badgeSupported = isSupported;
      }
      if (!this.badgeSupported) return;
      await badge.set({ count: Math.max(0, Math.trunc(count)) });
    } catch (err) {
      this.logger.warn('[Push] setBadge falló (se ignora):', err);
    }
  }
}
