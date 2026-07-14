import { Injectable, effect, inject } from '@angular/core';
import { SessionService } from '../auth/services/session.service';
import { ConvexService } from '../convex/convex.service';
import { PlatformService } from './platform.service';
import { PushNotificationService } from './push-notification.service';
import { api } from '../../../../../../convex/_generated/api';

/**
 * Mantiene el número del badge del icono de la app sincronizado con el total
 * real de mensajes no leídos del usuario, mientras la app está viva.
 *
 * Por qué existe: el servidor sube el badge vía payload APNs cuando llega una
 * push de chat (app cerrada/background), pero nada lo bajaba al leer — el
 * plugin de FCM no expone API de badge y `markAsRead` no emite push. Este
 * servicio cierra el hueco: espeja reactivamente `getMyUnreadTotal` (Convex)
 * al badge del icono, así que al leer (que resetea los contadores) el número
 * baja de inmediato.
 *
 * Reparto de responsabilidades:
 *  - Servidor = autoridad cuando la app NO está viva (badge en la push de chat).
 *  - Este servicio = autoridad cuando la app está viva.
 *
 * Solo iOS: es la única plataforma donde el badge numérico es un problema (en
 * Android el `aps.badge` se ignora y el "dot" del launcher se limpia vaciando
 * la bandeja). En no-iOS el servicio es inerte (ni suscripción ni effect).
 *
 * Se instancia app-wide desde `AppComponent` (bloque nativo) para no depender
 * de que el usuario abra la pestaña de mensajes.
 */
@Injectable({ providedIn: 'root' })
export class BadgeSyncService {
  private readonly convex = inject(ConvexService);
  private readonly session = inject(SessionService);
  private readonly platform = inject(PlatformService);
  private readonly push = inject(PushNotificationService);

  /** Último valor efectivamente enviado a `setBadge`, para deduplicar. */
  private lastBadgeSet: number | null = null;

  constructor() {
    // El badge numérico del icono solo es un problema real en iOS. En el resto
    // no montamos ni la suscripción reactiva ni el effect.
    if (!this.platform.isIOS()) return;

    const unreadTotalQuery = this.convex.watchQuery(
      api.conversations.queries.getMyUnreadTotal,
      () => {
        if (!this.session.usuario()?.id) return 'skip' as const;
        return {};
      },
    );

    effect(() => {
      // Cold start: hasta que la sesión no esté inicializada no tocamos el
      // badge, para respetar el valor que el server dejó en el icono con la app
      // cerrada (si lo pisáramos con 0 aquí, parpadearía N→0→N).
      if (!this.session.sesionInicializada()) return;

      // Logout (o sesión sin usuario válido): limpiar el icono.
      if (!this.session.isLoggedIn()) {
        this.applyBadge(0);
        return;
      }

      // Con sesión: espejar el total real. Gate de hidratación: si la query aún
      // no ha emitido (`undefined`), no tocar — esperamos al primer valor real.
      const total = unreadTotalQuery.value();
      if (total === undefined) return;
      this.applyBadge(total);
    });
  }

  /** Fija el badge solo si cambió respecto al último valor puesto. */
  private applyBadge(count: number): void {
    if (count === this.lastBadgeSet) return;
    this.lastBadgeSet = count;
    void this.push.setBadge(count);
  }
}
