import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import {
  FirebaseMessaging,
  type Notification,
} from '@capacitor-firebase/messaging';
import { ConvexService } from '../convex/convex.service';
import { PlatformService } from './platform.service';
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
   * Inicializa el sistema de push para el usuario autenticado actual.
   * Idempotente: si ya se ha inicializado y el token sigue vivo, solo hace
   * un `touch`. Llamar SIEMPRE después de tener sesión válida.
   */
  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this._initialized.set(true);
      return;
    }

    try {
      const perm = await FirebaseMessaging.requestPermissions();
      this._permissionState.set(perm.receive as PermissionState);
      if (perm.receive !== 'granted') {
        this._initialized.set(true);
        return;
      }

      const deviceId = await this.getDeviceId();
      const { token } = await FirebaseMessaging.getToken();
      this._token.set(token);

      await this.registerToken(token, deviceId);
      this.registerListeners();
      this._initialized.set(true);
    } catch (err) {
      console.error('[Push] init falló:', err);
      this._initialized.set(true);
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
      await this.convex.mutation(api.push.mutations.unregisterPushToken, {
        deviceId,
      });
    } catch (err) {
      console.warn('[Push] unregister falló (se ignora):', err);
    }

    try {
      await FirebaseMessaging.removeAllListeners();
    } catch {
      // ignorar
    }
    this.resetLocalState();
  }

  private resetLocalState(): void {
    this.listenersRegistered = false;
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

  private registerListeners(): void {
    if (this.listenersRegistered) return;
    this.listenersRegistered = true;

    FirebaseMessaging.addListener('tokenReceived', async ({ token }) => {
      this._token.set(token);
      try {
        const deviceId = await this.getDeviceId();
        await this.registerToken(token, deviceId);
      } catch (err) {
        console.error('[Push] tokenReceived re-register falló:', err);
      }
    });

    FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
      this.navigateForNotification(notification);
    });

    // `notificationReceived` se dispara con app en foreground. Como
    // `presentationOptions` está configurado a alert+badge+sound, iOS
    // muestra el banner por su cuenta y no hacemos nada aquí; Android
    // por defecto no muestra notificación en foreground, pero al ser un
    // mensaje del propio chat la UI ya está reaccionando (la query reactiva
    // del thread se actualiza sola). Si en el futuro hace falta un toast
    // in-app, este es el listener donde engancharlo.
    FirebaseMessaging.addListener('notificationReceived', () => {
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
  }
}
