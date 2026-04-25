import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SessionService } from '../auth/services/session.service';
import { ConvexService } from '../convex/convex.service';
import { api } from '../../../../../../convex/_generated/api';
import type { NotificacionApp } from '../../../types/global';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private router = inject(Router);
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);

  private readonly suscripcion = this.convex.watchQuery(
    api.notifications.queries.listForCurrentFisio,
    () => {
      const usuario = this.sessionService.usuario();
      const rol = this.sessionService.rolUsuario();
      if (!usuario?.id || rol !== 'fisio') return 'skip' as const;
      return {};
    },
  );

  private overrides = signal<Record<string, boolean>>({});

  readonly notificaciones = computed<NotificacionApp[]>(() => {
    const data = this.suscripcion.value();
    if (!data) return [];
    const overrides = this.overrides();
    return data.notificaciones.map((n) =>
      overrides[n.id] !== undefined ? { ...n, leida: overrides[n.id] } : n,
    );
  });

  readonly pendientes = computed(
    () => this.notificaciones().filter((n) => !n.leida).length,
  );

  readonly cargando = this.suscripcion.isLoading;
  readonly hayPendientes = computed(() => this.pendientes() > 0);

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        // La suscripción Convex es reactiva; no hay recarga manual.
      });
  }

  async recargar(): Promise<void> {
    // La suscripción se actualiza sola; método preservado por compatibilidad.
  }

  async marcarRevisada(n: NotificacionApp): Promise<void> {
    if (n.leida) return;

    this.overrides.update((o) => ({ ...o, [n.id]: true }));
    try {
      await this.convex.mutation(api.notifications.mutations.markAsRead, {
        notificationId: n.id as any,
      });
    } catch (err) {
      console.error('Error al marcar notificación como revisada:', err);
      this.overrides.update((o) => ({ ...o, [n.id]: false }));
    }
  }

  async marcarTodasRevisadas(): Promise<void> {
    const prevIds = this.notificaciones().filter((n) => !n.leida).map((n) => n.id);
    this.overrides.update((o) => {
      const next = { ...o };
      for (const id of prevIds) next[id] = true;
      return next;
    });
    try {
      await this.convex.mutation(
        api.notifications.mutations.markAllAsReadForCurrentFisio,
        {},
      );
    } catch (err) {
      console.error('Error al marcar todas como revisadas:', err);
      this.overrides.update((o) => {
        const next = { ...o };
        for (const id of prevIds) next[id] = false;
        return next;
      });
    }
  }
}
